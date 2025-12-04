package com.urbanz.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(RunTrackingPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
