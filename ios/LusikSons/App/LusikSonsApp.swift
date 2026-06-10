import SwiftUI

@main
struct LusikSonsApp: App {
    @StateObject private var cart = CartStore()

    var body: some Scene {
        WindowGroup {
            RootTabView()
                .environmentObject(cart)
                .tint(Brand.accent)
        }
    }
}
