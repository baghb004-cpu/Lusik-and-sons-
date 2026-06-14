//go:build windows

// Minimal Win32 helpers the launcher still needs: a native message box (for the
// "WebView2 runtime missing" case) and opening a folder in Explorer. Pure
// stdlib, no cgo.
package main

import (
	"syscall"
	"unsafe"
)

var (
	user32  = syscall.NewLazyDLL("user32.dll")
	shell32 = syscall.NewLazyDLL("shell32.dll")

	pMessageBoxW   = user32.NewProc("MessageBoxW")
	pShellExecuteW = shell32.NewProc("ShellExecuteW")
)

const (
	mbOK              = 0x00000000
	mbIconError       = 0x00000010
	mbIconInformation = 0x00000040
	swShowNormal      = 1
)

func u16(s string) *uint16 { p, _ := syscall.UTF16PtrFromString(s); return p }

func messageBox(text, caption string, flags uintptr) {
	pMessageBoxW.Call(0,
		uintptr(unsafe.Pointer(u16(text))),
		uintptr(unsafe.Pointer(u16(caption))),
		flags)
}

func shellOpen(path string) {
	pShellExecuteW.Call(0,
		uintptr(unsafe.Pointer(u16("open"))),
		uintptr(unsafe.Pointer(u16(path))),
		0, 0, swShowNormal)
}
