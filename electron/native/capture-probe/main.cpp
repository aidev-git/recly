// recly-capture-probe: a minimal, original proof-of-concept for native Windows screen
// capture via the DXGI Desktop Duplication API (IDXGIOutputDuplication). It captures a
// single frame from the primary monitor and writes it to a BMP file, to verify the whole
// pipeline (D3D11 device creation, output duplication, frame acquisition, GPU->CPU
// readback) works end to end before building a continuous capture+encode session on top
// of it. Written from scratch against the public Win32/DXGI API surface — no third-party
// or Recordly source was read or referenced.

#include <d3d11.h>
#include <dxgi1_2.h>
#include <windows.h>
#include <wrl/client.h>

#include <cstdint>
#include <cstdio>
#include <vector>

#pragma comment(lib, "d3d11.lib")
#pragma comment(lib, "dxgi.lib")

namespace {

void PrintError(const char* what, HRESULT hr) {
	fprintf(stderr, "%s failed (hr=0x%08lx)\n", what, static_cast<unsigned long>(hr));
}

// Writes a 32-bit BGRA buffer as an uncompressed 32bpp BMP.
bool WriteBmp(const wchar_t* path, const uint8_t* pixels, UINT width, UINT height, UINT rowPitch) {
	BITMAPFILEHEADER fileHeader = {};
	BITMAPINFOHEADER infoHeader = {};

	const DWORD imageSize = width * height * 4;
	fileHeader.bfType = 0x4D42; // "BM"
	fileHeader.bfOffBits = sizeof(BITMAPFILEHEADER) + sizeof(BITMAPINFOHEADER);
	fileHeader.bfSize = fileHeader.bfOffBits + imageSize;

	infoHeader.biSize = sizeof(BITMAPINFOHEADER);
	infoHeader.biWidth = static_cast<LONG>(width);
	infoHeader.biHeight = -static_cast<LONG>(height); // negative = top-down rows
	infoHeader.biPlanes = 1;
	infoHeader.biBitCount = 32;
	infoHeader.biCompression = BI_RGB;
	infoHeader.biSizeImage = imageSize;

	FILE* file = nullptr;
	if (_wfopen_s(&file, path, L"wb") != 0 || !file) {
		fprintf(stderr, "Could not open output file for writing.\n");
		return false;
	}

	fwrite(&fileHeader, sizeof(fileHeader), 1, file);
	fwrite(&infoHeader, sizeof(infoHeader), 1, file);

	std::vector<uint8_t> row(width * 4);
	for (UINT y = 0; y < height; y += 1) {
		memcpy(row.data(), pixels + static_cast<size_t>(y) * rowPitch, row.size());
		fwrite(row.data(), row.size(), 1, file);
	}

	fclose(file);
	return true;
}

} // namespace

int wmain(int argc, wchar_t* argv[]) {
	const wchar_t* outputPath = argc > 1 ? argv[1] : L"capture-probe.bmp";

	Microsoft::WRL::ComPtr<ID3D11Device> device;
	Microsoft::WRL::ComPtr<ID3D11DeviceContext> context;
	D3D_FEATURE_LEVEL featureLevel;

	HRESULT hr = D3D11CreateDevice(
		nullptr,
		D3D_DRIVER_TYPE_HARDWARE,
		nullptr,
		0,
		nullptr,
		0,
		D3D11_SDK_VERSION,
		&device,
		&featureLevel,
		&context);
	if (FAILED(hr)) {
		PrintError("D3D11CreateDevice", hr);
		return 1;
	}

	Microsoft::WRL::ComPtr<IDXGIDevice> dxgiDevice;
	hr = device.As(&dxgiDevice);
	if (FAILED(hr)) {
		PrintError("QueryInterface(IDXGIDevice)", hr);
		return 1;
	}

	Microsoft::WRL::ComPtr<IDXGIAdapter> adapter;
	hr = dxgiDevice->GetAdapter(&adapter);
	if (FAILED(hr)) {
		PrintError("GetAdapter", hr);
		return 1;
	}

	Microsoft::WRL::ComPtr<IDXGIOutput> output;
	hr = adapter->EnumOutputs(0, &output);
	if (FAILED(hr)) {
		PrintError("EnumOutputs", hr);
		return 1;
	}

	Microsoft::WRL::ComPtr<IDXGIOutput1> output1;
	hr = output.As(&output1);
	if (FAILED(hr)) {
		PrintError("QueryInterface(IDXGIOutput1)", hr);
		return 1;
	}

	Microsoft::WRL::ComPtr<IDXGIOutputDuplication> duplication;
	hr = output1->DuplicateOutput(device.Get(), &duplication);
	if (FAILED(hr)) {
		PrintError("DuplicateOutput", hr);
		return 1;
	}

	// The very first frame off a freshly-created duplication reliably comes back with
	// AccumulatedFrames == 0 and LastPresentTime == 0 — an empty "priming" frame, not real
	// desktop content (confirmed by instrumenting this exact loop). Skip frames until one
	// actually has accumulated real presentation data.
	DXGI_OUTDUPL_FRAME_INFO frameInfo = {};
	Microsoft::WRL::ComPtr<IDXGIResource> desktopResource;
	bool acquired = false;
	for (int attempt = 0; attempt < 40 && !acquired; attempt += 1) {
		DXGI_OUTDUPL_FRAME_INFO candidateInfo = {};
		Microsoft::WRL::ComPtr<IDXGIResource> candidateResource;
		hr = duplication->AcquireNextFrame(500, &candidateInfo, &candidateResource);
		if (hr == DXGI_ERROR_WAIT_TIMEOUT) {
			continue;
		}
		if (FAILED(hr)) {
			PrintError("AcquireNextFrame", hr);
			return 1;
		}
		if (candidateInfo.AccumulatedFrames == 0) {
			duplication->ReleaseFrame();
			continue;
		}
		frameInfo = candidateInfo;
		desktopResource = candidateResource;
		acquired = true;
	}
	if (!acquired) {
		fprintf(stderr, "Timed out waiting for a frame with real content.\n");
		return 1;
	}

	Microsoft::WRL::ComPtr<ID3D11Texture2D> frameTexture;
	hr = desktopResource.As(&frameTexture);
	if (FAILED(hr)) {
		PrintError("QueryInterface(ID3D11Texture2D)", hr);
		return 1;
	}

	D3D11_TEXTURE2D_DESC desc = {};
	frameTexture->GetDesc(&desc);

	D3D11_TEXTURE2D_DESC stagingDesc = desc;
	stagingDesc.Usage = D3D11_USAGE_STAGING;
	stagingDesc.BindFlags = 0;
	stagingDesc.CPUAccessFlags = D3D11_CPU_ACCESS_READ;
	stagingDesc.MiscFlags = 0;

	Microsoft::WRL::ComPtr<ID3D11Texture2D> stagingTexture;
	hr = device->CreateTexture2D(&stagingDesc, nullptr, &stagingTexture);
	if (FAILED(hr)) {
		PrintError("CreateTexture2D(staging)", hr);
		return 1;
	}

	context->CopyResource(stagingTexture.Get(), frameTexture.Get());

	D3D11_MAPPED_SUBRESOURCE mapped = {};
	hr = context->Map(stagingTexture.Get(), 0, D3D11_MAP_READ, 0, &mapped);
	if (FAILED(hr)) {
		PrintError("Map", hr);
		return 1;
	}

	const bool wrote = WriteBmp(
		outputPath,
		static_cast<const uint8_t*>(mapped.pData),
		desc.Width,
		desc.Height,
		mapped.RowPitch);

	context->Unmap(stagingTexture.Get(), 0);
	duplication->ReleaseFrame();

	if (!wrote) {
		return 1;
	}

	wprintf(L"Captured %ux%u frame to %s\n", desc.Width, desc.Height, outputPath);
	return 0;
}
