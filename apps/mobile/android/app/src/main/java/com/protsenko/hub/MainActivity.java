package com.protsenko.hub;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SleepWidgetPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
