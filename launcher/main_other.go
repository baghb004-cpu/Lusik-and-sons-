//go:build !windows

// The launcher is a native Windows app. This stub lets the module compile on
// non-Windows hosts (CI / dev) without doing anything.
package main

import "fmt"

func main() { fmt.Println("Baghdo's Workshop launcher is a Windows app. Build with: GOOS=windows GOARCH=amd64 go build") }
