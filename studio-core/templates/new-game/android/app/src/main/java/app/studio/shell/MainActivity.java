package app.studio.shell;

import android.app.Activity;
import android.os.Bundle;
import android.webkit.WebView;

/**
 * Capacitor-shaped WebView shell. It loads the packaged page and does not
 * depend on the Mobile Ads SDK. A synchronous ad bridge, when the page
 * installs one, stays in JavaScript so the studio guard can refuse it.
 */
public class MainActivity extends Activity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WebView web = new WebView(this);
        setContentView(web);
        web.getSettings().setJavaScriptEnabled(true);
        web.loadUrl("file:///android_asset/www/index.html");
    }
}
