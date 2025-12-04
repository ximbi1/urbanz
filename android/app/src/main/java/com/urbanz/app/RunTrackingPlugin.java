package com.urbanz.app;

import android.content.Context;
import android.content.Intent;
import android.os.Build;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.PluginMethod;

@CapacitorPlugin(name = "RunTracking")
public class RunTrackingPlugin extends Plugin {

    @PluginMethod
    public void startService(PluginCall call) {
        Context context = getContext();
        Intent intent = new Intent(context, RunTrackingService.class);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent);
            } else {
                context.startService(intent);
            }
            call.resolve();
        } catch (Exception ex) {
            call.reject("No se pudo iniciar el servicio de tracking", ex);
        }
    }

    @PluginMethod
    public void stopService(PluginCall call) {
        Context context = getContext();
        Intent intent = new Intent(context, RunTrackingService.class);
        context.stopService(intent);
        call.resolve();
    }
}
