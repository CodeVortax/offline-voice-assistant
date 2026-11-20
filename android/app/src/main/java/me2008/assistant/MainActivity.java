package me2008.assistant;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {

    private static final int AUDIO_PERMISSION_REQUEST_CODE = 2008;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
                != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(
                this,
                new String[] { Manifest.permission.RECORD_AUDIO },
                AUDIO_PERMISSION_REQUEST_CODE
            );
        }

        if (this.bridge != null && this.bridge.getWebView() != null) {
            WebView webView = this.bridge.getWebView();
            webView.addJavascriptInterface(new VickyAndroidBridge(), "AndroidBridge");
        }
    }

    public class VickyAndroidBridge {
        @JavascriptInterface
        public void onVickyAction(String payloadJson) {
            try {
                JSONObject json = new JSONObject(payloadJson);
                String uriString = json.optString("uri", "").trim();
                if (uriString.isEmpty()) {
                    return;
                }

                Intent intent;
                if (uriString.startsWith("intent:")) {
                    intent = Intent.parseUri(uriString, Intent.URI_INTENT_SCHEME);
                } else {
                    intent = new Intent(Intent.ACTION_VIEW, Uri.parse(uriString));
                }
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(intent);
            } catch (Exception ignored) {
                // Ignore unresolvable external intents inside sandbox/testing
            }
        }
    }
}
