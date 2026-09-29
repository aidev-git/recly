// recly-capture-record: original native Windows screen recorder. Captures the desktop
// continuously via DXGI Desktop Duplication and encodes it to H.264/MP4 via Media
// Foundation's Sink Writer. Runs until a line is read from stdin (or stdin closes), then
// finalizes the file and exits. Written from scratch against the public Win32/DXGI/Media
// Foundation API surface — no third-party or Recordly source was read or referenced.
//
// Usage: recly-capture-record.exe --output <path.mp4> [--monitor <index>] [--fps <n>]
//                                  [--bitrate <bps>]

#include <audioclient.h>
#include <d3d11.h>
#include <dxgi1_2.h>
#include <mfapi.h>
#include <mfidl.h>
#include <mfreadwrite.h>
#include <mmdeviceapi.h>
#include <windows.h>
#include <wrl/client.h>

#include <atomic>
#include <chrono>
#include <cstdio>
#include <cstdlib>
#include <iostream>
#include <string>
#include <thread>
#include <vector>

#pragma comment(lib, "d3d11.lib")
#pragma comment(lib, "dxgi.lib")
#pragma comment(lib, "mfplat.lib")
#pragma comment(lib, "mfreadwrite.lib")
#pragma comment(lib, "mfuuid.lib")
#pragma comment(lib, "ole32.lib")

using Microsoft::WRL::ComPtr;

namespace {

void PrintError(const char* what, HRESULT hr) {
	fprintf(stderr, "%s failed (hr=0x%08lx)\n", what, static_cast<unsigned long>(hr));
}

// Same value as ksmedia.h's KSDATAFORMAT_SUBTYPE_IEEE_FLOAT, restated here to avoid pulling in
// the DDK headers/libs just for one GUID constant.
const GUID kSubtypeIeeeFloat = {
	0x00000003, 0x0000, 0x0010, {0x80, 0x00, 0x00, 0xAA, 0x00, 0x38, 0x9B, 0x71}};

struct Options {
	std::wstring outputPath;
	UINT monitorIndex = 0;
	UINT32 fps = 30;
	UINT32 bitrate = 8'000'000;
};

bool ParseArgs(int argc, wchar_t* argv[], Options& options) {
	for (int i = 1; i < argc; i += 1) {
		std::wstring arg = argv[i];
		auto next = [&]() -> std::wstring { return i + 1 < argc ? argv[++i] : L""; };
		if (arg == L"--output") {
			options.outputPath = next();
		} else if (arg == L"--monitor") {
			options.monitorIndex = static_cast<UINT>(_wtoi(next().c_str()));
		} else if (arg == L"--fps") {
			options.fps = static_cast<UINT32>(_wtoi(next().c_str()));
		} else if (arg == L"--bitrate") {
			options.bitrate = static_cast<UINT32>(_wtoi(next().c_str()));
		}
	}
	return !options.outputPath.empty();
}

// Watches stdin on a background thread; any line (or EOF) sets `stopRequested`. This is how
// the Electron parent process signals "stop recording" to this child process.
std::atomic<bool> g_stopRequested{false};

void WatchStdinForStop() {
	std::string line;
	std::getline(std::cin, line);
	g_stopRequested.store(true);
}

} // namespace

int wmain(int argc, wchar_t* argv[]) {
	Options options;
	if (!ParseArgs(argc, argv, options)) {
		fprintf(stderr, "Usage: recly-capture-record.exe --output <path.mp4> [--monitor N] [--fps N] [--bitrate N]\n");
		return 1;
	}

	HRESULT hr = CoInitializeEx(nullptr, COINIT_MULTITHREADED);
	if (FAILED(hr)) {
		PrintError("CoInitializeEx", hr);
		return 1;
	}

	hr = MFStartup(MF_VERSION);
	if (FAILED(hr)) {
		PrintError("MFStartup", hr);
		return 1;
	}

	// --- D3D11 device + DXGI output duplication (validated in capture-probe) -------------
	ComPtr<ID3D11Device> device;
	ComPtr<ID3D11DeviceContext> context;
	D3D_FEATURE_LEVEL featureLevel;
	hr = D3D11CreateDevice(
		nullptr, D3D_DRIVER_TYPE_HARDWARE, nullptr, 0, nullptr, 0, D3D11_SDK_VERSION, &device, &featureLevel, &context);
	if (FAILED(hr)) {
		PrintError("D3D11CreateDevice", hr);
		return 1;
	}

	ComPtr<IDXGIDevice> dxgiDevice;
	hr = device.As(&dxgiDevice);
	if (FAILED(hr)) {
		PrintError("QueryInterface(IDXGIDevice)", hr);
		return 1;
	}

	ComPtr<IDXGIAdapter> adapter;
	hr = dxgiDevice->GetAdapter(&adapter);
	if (FAILED(hr)) {
		PrintError("GetAdapter", hr);
		return 1;
	}

	ComPtr<IDXGIOutput> output;
	hr = adapter->EnumOutputs(options.monitorIndex, &output);
	if (FAILED(hr)) {
		PrintError("EnumOutputs", hr);
		return 1;
	}

	ComPtr<IDXGIOutput1> output1;
	hr = output.As(&output1);
	if (FAILED(hr)) {
		PrintError("QueryInterface(IDXGIOutput1)", hr);
		return 1;
	}

	ComPtr<IDXGIOutputDuplication> duplication;
	hr = output1->DuplicateOutput(device.Get(), &duplication);
	if (FAILED(hr)) {
		PrintError("DuplicateOutput", hr);
		return 1;
	}

	// IDXGIOutput::GetDesc's DesktopCoordinates are DPI-virtualized logical coordinates on
	// a per-monitor-DPI-aware process, which do NOT match the duplication's actual pixel
	// buffer size. DXGI_OUTDUPL_DESC.ModeDesc reflects the real physical frame dimensions.
	DXGI_OUTDUPL_DESC duplicationDesc = {};
	duplication->GetDesc(&duplicationDesc);
	const UINT32 width = duplicationDesc.ModeDesc.Width;
	const UINT32 height = duplicationDesc.ModeDesc.Height;

	// Reusable CPU-readable staging texture, sized once to the output resolution.
	D3D11_TEXTURE2D_DESC stagingDesc = {};
	stagingDesc.Width = width;
	stagingDesc.Height = height;
	stagingDesc.MipLevels = 1;
	stagingDesc.ArraySize = 1;
	stagingDesc.Format = DXGI_FORMAT_B8G8R8A8_UNORM;
	stagingDesc.SampleDesc.Count = 1;
	stagingDesc.Usage = D3D11_USAGE_STAGING;
	stagingDesc.CPUAccessFlags = D3D11_CPU_ACCESS_READ;

	ComPtr<ID3D11Texture2D> stagingTexture;
	hr = device->CreateTexture2D(&stagingDesc, nullptr, &stagingTexture);
	if (FAILED(hr)) {
		PrintError("CreateTexture2D(staging)", hr);
		return 1;
	}

	// --- Media Foundation sink writer: H.264/MP4, fed uncompressed BGRA frames ------------
	ComPtr<IMFAttributes> writerAttributes;
	hr = MFCreateAttributes(&writerAttributes, 2);
	if (SUCCEEDED(hr)) {
		writerAttributes->SetUINT32(MF_SINK_WRITER_DISABLE_THROTTLING, TRUE);
		writerAttributes->SetUINT32(MF_READWRITE_ENABLE_HARDWARE_TRANSFORMS, TRUE);
	}

	ComPtr<IMFSinkWriter> sinkWriter;
	hr = MFCreateSinkWriterFromURL(options.outputPath.c_str(), nullptr, writerAttributes.Get(), &sinkWriter);
	if (FAILED(hr)) {
		PrintError("MFCreateSinkWriterFromURL", hr);
		return 1;
	}

	ComPtr<IMFMediaType> videoOutputType;
	MFCreateMediaType(&videoOutputType);
	videoOutputType->SetGUID(MF_MT_MAJOR_TYPE, MFMediaType_Video);
	videoOutputType->SetGUID(MF_MT_SUBTYPE, MFVideoFormat_H264);
	videoOutputType->SetUINT32(MF_MT_AVG_BITRATE, options.bitrate);
	videoOutputType->SetUINT32(MF_MT_INTERLACE_MODE, MFVideoInterlace_Progressive);
	MFSetAttributeSize(videoOutputType.Get(), MF_MT_FRAME_SIZE, width, height);
	MFSetAttributeRatio(videoOutputType.Get(), MF_MT_FRAME_RATE, options.fps, 1);
	MFSetAttributeRatio(videoOutputType.Get(), MF_MT_PIXEL_ASPECT_RATIO, 1, 1);

	DWORD videoStreamIndex = 0;
	hr = sinkWriter->AddStream(videoOutputType.Get(), &videoStreamIndex);
	if (FAILED(hr)) {
		PrintError("AddStream(video)", hr);
		return 1;
	}

	ComPtr<IMFMediaType> videoInputType;
	MFCreateMediaType(&videoInputType);
	videoInputType->SetGUID(MF_MT_MAJOR_TYPE, MFMediaType_Video);
	videoInputType->SetGUID(MF_MT_SUBTYPE, MFVideoFormat_RGB32);
	videoInputType->SetUINT32(MF_MT_INTERLACE_MODE, MFVideoInterlace_Progressive);
	MFSetAttributeSize(videoInputType.Get(), MF_MT_FRAME_SIZE, width, height);
	MFSetAttributeRatio(videoInputType.Get(), MF_MT_FRAME_RATE, options.fps, 1);
	MFSetAttributeRatio(videoInputType.Get(), MF_MT_PIXEL_ASPECT_RATIO, 1, 1);
	videoInputType->SetUINT32(MF_MT_DEFAULT_STRIDE, static_cast<UINT32>(width * 4));

	hr = sinkWriter->SetInputMediaType(videoStreamIndex, videoInputType.Get(), nullptr);
	if (FAILED(hr)) {
		PrintError("SetInputMediaType(video)", hr);
		return 1;
	}

	// --- WASAPI loopback audio (captures whatever is playing through the default output) --
	ComPtr<IMMDeviceEnumerator> deviceEnumerator;
	hr = CoCreateInstance(
		__uuidof(MMDeviceEnumerator), nullptr, CLSCTX_ALL, IID_PPV_ARGS(&deviceEnumerator));
	ComPtr<IMMDevice> renderDevice;
	if (SUCCEEDED(hr)) {
		hr = deviceEnumerator->GetDefaultAudioEndpoint(eRender, eConsole, &renderDevice);
	}
	ComPtr<IAudioClient> audioClient;
	if (SUCCEEDED(hr)) {
		hr = renderDevice->Activate(__uuidof(IAudioClient), CLSCTX_ALL, nullptr, &audioClient);
	}
	WAVEFORMATEX* mixFormat = nullptr;
	if (SUCCEEDED(hr)) {
		hr = audioClient->GetMixFormat(&mixFormat);
	}
	const bool hasAudio = SUCCEEDED(hr) && mixFormat != nullptr;
	DWORD audioStreamIndex = 0;
	ComPtr<IAudioCaptureClient> audioCaptureClient;

	if (hasAudio) {
		hr = audioClient->Initialize(
			AUDCLNT_SHAREMODE_SHARED, AUDCLNT_STREAMFLAGS_LOOPBACK, 10'000'000, 0, mixFormat, nullptr);
		if (SUCCEEDED(hr)) {
			hr = audioClient->GetService(IID_PPV_ARGS(&audioCaptureClient));
		}
		if (FAILED(hr)) {
			PrintError("WASAPI loopback initialize", hr);
		} else {
			ComPtr<IMFMediaType> audioOutputType;
			MFCreateMediaType(&audioOutputType);
			audioOutputType->SetGUID(MF_MT_MAJOR_TYPE, MFMediaType_Audio);
			audioOutputType->SetGUID(MF_MT_SUBTYPE, MFAudioFormat_AAC);
			audioOutputType->SetUINT32(MF_MT_AUDIO_SAMPLES_PER_SECOND, mixFormat->nSamplesPerSec);
			audioOutputType->SetUINT32(MF_MT_AUDIO_NUM_CHANNELS, mixFormat->nChannels);
			audioOutputType->SetUINT32(MF_MT_AUDIO_AVG_BYTES_PER_SECOND, 16'000);
			audioOutputType->SetUINT32(MF_MT_AUDIO_BITS_PER_SAMPLE, 16);

			DWORD audioStreamIndexLocal = 0;
			hr = sinkWriter->AddStream(audioOutputType.Get(), &audioStreamIndexLocal);
			if (SUCCEEDED(hr)) {
				audioStreamIndex = audioStreamIndexLocal;

				ComPtr<IMFMediaType> audioInputType;
				MFCreateMediaType(&audioInputType);
				audioInputType->SetGUID(MF_MT_MAJOR_TYPE, MFMediaType_Audio);
				audioInputType->SetGUID(MF_MT_SUBTYPE, MFAudioFormat_PCM);
				audioInputType->SetUINT32(MF_MT_AUDIO_SAMPLES_PER_SECOND, mixFormat->nSamplesPerSec);
				audioInputType->SetUINT32(MF_MT_AUDIO_NUM_CHANNELS, mixFormat->nChannels);
				audioInputType->SetUINT32(MF_MT_AUDIO_BITS_PER_SAMPLE, 16);
				audioInputType->SetUINT32(MF_MT_AUDIO_BLOCK_ALIGNMENT, mixFormat->nChannels * 2);
				audioInputType->SetUINT32(
					MF_MT_AUDIO_AVG_BYTES_PER_SECOND, mixFormat->nSamplesPerSec * mixFormat->nChannels * 2);

				hr = sinkWriter->SetInputMediaType(audioStreamIndex, audioInputType.Get(), nullptr);
				if (FAILED(hr)) {
					PrintError("SetInputMediaType(audio)", hr);
				}
			} else {
				PrintError("AddStream(audio)", hr);
			}
		}
	}
	const bool audioReady = hasAudio && audioCaptureClient != nullptr;

	hr = sinkWriter->BeginWriting();
	if (FAILED(hr)) {
		PrintError("BeginWriting", hr);
		return 1;
	}

	// Signal the parent process that setup succeeded and we're now actively recording.
	printf("RECORDING\n");
	fflush(stdout);

	std::thread stdinWatcher(WatchStdinForStop);

	LARGE_INTEGER frequency;
	QueryPerformanceFrequency(&frequency);
	LARGE_INTEGER startTime;
	QueryPerformanceCounter(&startTime);
	bool sawFirstRealFrame = false;
	UINT64 frameCount = 0;

	std::thread audioThread;
	if (audioReady) {
		audioThread = std::thread([&]() {
			audioClient->Start();
			const UINT32 bytesPerFrame = mixFormat->nChannels * 2; // output is always 16-bit PCM
			std::vector<uint8_t> convertBuffer;

			while (!g_stopRequested.load()) {
				UINT32 packetLength = 0;
				if (FAILED(audioCaptureClient->GetNextPacketSize(&packetLength))) break;
				if (packetLength == 0) {
					std::this_thread::sleep_for(std::chrono::milliseconds(5));
					continue;
				}

				BYTE* data = nullptr;
				UINT32 numFrames = 0;
				DWORD flags = 0;
				if (FAILED(audioCaptureClient->GetBuffer(&data, &numFrames, &flags, nullptr, nullptr))) break;

				const UINT32 outBytes = numFrames * bytesPerFrame;
				convertBuffer.resize(outBytes);

				if (flags & AUDCLNT_BUFFERFLAGS_SILENT) {
					memset(convertBuffer.data(), 0, outBytes);
				} else if (mixFormat->wFormatTag == WAVE_FORMAT_IEEE_FLOAT ||
						   (mixFormat->wFormatTag == WAVE_FORMAT_EXTENSIBLE &&
							reinterpret_cast<WAVEFORMATEXTENSIBLE*>(mixFormat)->SubFormat == kSubtypeIeeeFloat)) {
					const float* src = reinterpret_cast<const float*>(data);
					int16_t* dst = reinterpret_cast<int16_t*>(convertBuffer.data());
					const UINT32 sampleCount = numFrames * mixFormat->nChannels;
					for (UINT32 i = 0; i < sampleCount; i += 1) {
						float sample = src[i];
						sample = sample < -1.0f ? -1.0f : (sample > 1.0f ? 1.0f : sample);
						dst[i] = static_cast<int16_t>(sample * 32767.0f);
					}
				} else {
					memcpy(convertBuffer.data(), data, outBytes < (numFrames * mixFormat->nBlockAlign) ? outBytes : numFrames * mixFormat->nBlockAlign);
				}

				ComPtr<IMFMediaBuffer> audioBuffer;
				MFCreateMemoryBuffer(outBytes, &audioBuffer);
				BYTE* audioBufferData = nullptr;
				audioBuffer->Lock(&audioBufferData, nullptr, nullptr);
				memcpy(audioBufferData, convertBuffer.data(), outBytes);
				audioBuffer->Unlock();
				audioBuffer->SetCurrentLength(outBytes);

				LARGE_INTEGER now;
				QueryPerformanceCounter(&now);
				const LONGLONG elapsed100ns = ((now.QuadPart - startTime.QuadPart) * 10'000'000) / frequency.QuadPart;

				ComPtr<IMFSample> audioSample;
				MFCreateSample(&audioSample);
				audioSample->AddBuffer(audioBuffer.Get());
				audioSample->SetSampleTime(elapsed100ns);
				sinkWriter->WriteSample(audioStreamIndex, audioSample.Get());

				audioCaptureClient->ReleaseBuffer(numFrames);
			}
			audioClient->Stop();
		});
	}

	while (!g_stopRequested.load()) {
		DXGI_OUTDUPL_FRAME_INFO frameInfo = {};
		ComPtr<IDXGIResource> desktopResource;
		hr = duplication->AcquireNextFrame(100, &frameInfo, &desktopResource);
		if (hr == DXGI_ERROR_WAIT_TIMEOUT) {
			continue;
		}
		if (FAILED(hr)) {
			PrintError("AcquireNextFrame", hr);
			break;
		}

		// Only the very first frame off a fresh duplication is a genuinely empty "priming"
		// frame (LastPresentTime == 0); every later frame reflects real desktop state even
		// when AccumulatedFrames == 0 (that just means "unchanged since last acquire").
		if (!sawFirstRealFrame && frameInfo.LastPresentTime.QuadPart == 0) {
			duplication->ReleaseFrame();
			continue;
		}
		sawFirstRealFrame = true;

		ComPtr<ID3D11Texture2D> frameTexture;
		hr = desktopResource.As(&frameTexture);
		if (SUCCEEDED(hr)) {
			context->CopyResource(stagingTexture.Get(), frameTexture.Get());

			D3D11_MAPPED_SUBRESOURCE mapped = {};
			hr = context->Map(stagingTexture.Get(), 0, D3D11_MAP_READ, 0, &mapped);
			if (SUCCEEDED(hr)) {
				const DWORD tightBufferSize = width * height * 4;
				ComPtr<IMFMediaBuffer> buffer;
				MFCreateMemoryBuffer(tightBufferSize, &buffer);

				BYTE* bufferData = nullptr;
				buffer->Lock(&bufferData, nullptr, nullptr);
				const uint8_t* src = static_cast<const uint8_t*>(mapped.pData);
				for (UINT32 y = 0; y < height; y += 1) {
					memcpy(bufferData + static_cast<size_t>(y) * width * 4, src + static_cast<size_t>(y) * mapped.RowPitch, width * 4);
				}
				buffer->Unlock();
				buffer->SetCurrentLength(tightBufferSize);

				context->Unmap(stagingTexture.Get(), 0);

				LARGE_INTEGER now;
				QueryPerformanceCounter(&now);
				const LONGLONG elapsed100ns =
					((now.QuadPart - startTime.QuadPart) * 10'000'000) / frequency.QuadPart;

				ComPtr<IMFSample> sample;
				MFCreateSample(&sample);
				sample->AddBuffer(buffer.Get());
				sample->SetSampleTime(elapsed100ns);
				sample->SetSampleDuration(10'000'000 / options.fps);

				hr = sinkWriter->WriteSample(videoStreamIndex, sample.Get());
				if (FAILED(hr)) {
					PrintError("WriteSample(video)", hr);
				}
				frameCount += 1;
			}
		}

		duplication->ReleaseFrame();
	}

	if (audioThread.joinable()) {
		audioThread.join();
	}

	hr = sinkWriter->Finalize();
	if (FAILED(hr)) {
		PrintError("Finalize", hr);
	}

	stdinWatcher.join();

	if (mixFormat) {
		CoTaskMemFree(mixFormat);
	}

	// Every Media Foundation COM object must be released before MFShutdown() tears down MF's
	// global state — releasing them afterward (e.g. as these ComPtrs would naturally destruct
	// at end of scope) touches already-freed MF internals and crashes.
	sinkWriter.Reset();
	videoInputType.Reset();
	videoOutputType.Reset();
	writerAttributes.Reset();
	MFShutdown();

	duplication.Reset();
	stagingTexture.Reset();
	output1.Reset();
	output.Reset();
	adapter.Reset();
	dxgiDevice.Reset();
	context.Reset();
	device.Reset();

	audioCaptureClient.Reset();
	audioClient.Reset();
	renderDevice.Reset();
	deviceEnumerator.Reset();

	CoUninitialize();

	fprintf(stderr, "Wrote %llu frames to %ls\n", static_cast<unsigned long long>(frameCount), options.outputPath.c_str());
	return SUCCEEDED(hr) ? 0 : 1;
}
