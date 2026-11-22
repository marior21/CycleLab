// Loaded only by Electron's packaged main process, on the AppKit main thread.
#import <Sparkle/Sparkle.h>
#include <node_api.h>

static SPUStandardUpdaterController *controller;

static napi_value check(napi_env env, napi_callback_info info) {
    if (controller.updater.canCheckForUpdates) {
        [controller.updater checkForUpdates];
    }
    return NULL;
}

NAPI_MODULE_INIT() {
    controller = [[SPUStandardUpdaterController alloc] initWithStartingUpdater:NO
        updaterDelegate:nil userDriverDelegate:nil];
    NSError *error = nil;
    if (![controller.updater startUpdater:&error]) {
        napi_throw_error(env, NULL, error.localizedDescription.UTF8String);
        return NULL;
    }
    [controller.updater checkForUpdatesInBackground];
    napi_value function;
    napi_create_function(env, "check", NAPI_AUTO_LENGTH, check, NULL, &function);
    return function;
}
