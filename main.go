package main

import (
	"embed"
	"syscall"
	"unsafe"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

//go:embed all:frontend/dist
var assets embed.FS

const ERROR_ALREADY_EXISTS syscall.Errno = 183

func checkSingleInstance() (uintptr, error) {
	kernel32 := syscall.NewLazyDLL("kernel32.dll")
	createMutex := kernel32.NewProc("CreateMutexW")

	name, err := syscall.UTF16PtrFromString("Local\\GGitUploadSingleInstanceMutex")
	if err != nil {
		return 0, err
	}

	// CreateMutexW(lpMutexAttributes, bInitialOwner, lpName)
	ret, _, err := createMutex.Call(0, 0, uintptr(unsafe.Pointer(name)))
	if ret == 0 {
		return 0, err
	}

	if err != nil && err.(syscall.Errno) == ERROR_ALREADY_EXISTS {
		closeHandle := kernel32.NewProc("CloseHandle")
		closeHandle.Call(ret)
		return 0, err
	}

	return ret, nil
}

func showMessageBox(title, text string) {
	user32 := syscall.NewLazyDLL("user32.dll")
	messageBox := user32.NewProc("MessageBoxW")

	lpText, _ := syscall.UTF16PtrFromString(text)
	lpCaption, _ := syscall.UTF16PtrFromString(title)

	// MB_OK = 0x00000000
	// MB_ICONWARNING = 0x00000030
	// MB_SYSTEMMODAL = 0x00001000
	messageBox.Call(0, uintptr(unsafe.Pointer(lpText)), uintptr(unsafe.Pointer(lpCaption)), 0x00000030|0x00001000)
}

func main() {
	// Kiểm tra xem ứng dụng đã chạy chưa (Single Instance Check)
	mutexHandle, err := checkSingleInstance()
	if err != nil {
		showMessageBox("Thông báo", "Ứng dụng G-GitUpload đang chạy ngầm hoặc đã được mở ở một cửa sổ khác. Chỉ cho phép chạy một cửa sổ duy nhất.")
		return
	}
	defer func() {
		if mutexHandle != 0 {
			kernel32 := syscall.NewLazyDLL("kernel32.dll")
			closeHandle := kernel32.NewProc("CloseHandle")
			closeHandle.Call(mutexHandle)
		}
	}()

	// Create an instance of the app structure
	app := NewApp()

	// Create application with options
	wailsErr := wails.Run(&options.App{
		Title:  "G-GitUpload - Windows Tool",
		Width:  1100,
		Height: 720,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 15, G: 23, B: 42, A: 255},
		OnStartup:        app.startup,
		Bind: []interface{}{
			app,
		},
	})

	if wailsErr != nil {
		println("Error:", wailsErr.Error())
	}
}
