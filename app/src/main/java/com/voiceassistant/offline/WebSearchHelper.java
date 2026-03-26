package com.voiceassistant.offline;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public class WebSearchHelper {
    
    private static final String TAG = "WebSearchHelper";
    private Context context;
    private WebView webView;
    private SearchCallback callback;
    private Handler mainHandler;
    
    public interface SearchCallback {
        void onSearchComplete(String result);
        void onSearchError(String error);
    }
    
    public WebSearchHelper(Context context) {
        this.context = context;
        this.mainHandler = new Handler(Looper.getMainLooper());
    }
    
    public void searchAndGetResult(String query, SearchCallback callback) {
        this.callback = callback;
        
        mainHandler.post(() -> {
            try {
                // Initialize WebView if not already done
                if (webView == null) {
                    webView = new WebView(context);
                    webView.getSettings().setJavaScriptEnabled(true);
                    webView.getSettings().setDomStorageEnabled(true);
                    webView.addJavascriptInterface(new WebAppInterface(), "Android");
                }
                
                // Set WebViewClient to handle page load
                webView.setWebViewClient(new WebViewClient() {
                    @Override
                    public void onPageFinished(WebView view, String url) {
                        super.onPageFinished(view, url);
                        
                        // Extract search result using JavaScript
                        String javascript = 
                            "(function() {" +
                            "  try {" +
                            "    var result = '';" +
                            "    var searchDiv = document.querySelector('.BNeawe.s3v9rd.AP7Wnd');" +
                            "    if (searchDiv) {" +
                            "      result = searchDiv.innerText;" +
                            "    } else {" +
                            "      var snippets = document.querySelectorAll('.BNeawe');" +
                            "      if (snippets && snippets.length > 0) {" +
                            "        result = snippets[0].innerText;" +
                            "      }" +
                            "    }" +
                            "    if (!result || result.length < 10) {" +
                            "      var allText = document.body.innerText;" +
                            "      var lines = allText.split('\\n');" +
                            "      for (var i = 0; i < Math.min(lines.length, 20); i++) {" +
                            "        if (lines[i].length > 30 && !lines[i].includes('http')) {" +
                            "          result = lines[i];" +
                            "          break;" +
                            "        }" +
                            "      }" +
                            "    }" +
                            "    Android.receiveResult(result || 'No result found');" +
                            "  } catch(e) {" +
                            "    Android.receiveResult('Error extracting result: ' + e.message);" +
                            "  }" +
                            "})();";
                        
                        view.evaluateJavascript(javascript, null);
                        
                        // Auto-close after 2 seconds
                        mainHandler.postDelayed(() -> {
                            cleanup();
                        }, 2000);
                    }
                });
                
                // Load Google search with query
                String searchUrl = "https://www.google.com/search?q=" + 
                                 android.net.Uri.encode(query) + "&hl=en";
                
                Log.i(TAG, "Searching for: " + query);
                webView.loadUrl(searchUrl);
                
            } catch (Exception e) {
                Log.e(TAG, "Error during web search", e);
                if (callback != null) {
                    callback.onSearchError("Failed to search: " + e.getMessage());
                }
            }
        });
    }
    
    private class WebAppInterface {
        @JavascriptInterface
        public void receiveResult(String result) {
            Log.i(TAG, "Received result: " + result);
            
            mainHandler.post(() -> {
                if (callback != null) {
                    // Clean up the result
                    String cleanResult = result.trim();
                    if (cleanResult.length() > 200) {
                        cleanResult = cleanResult.substring(0, 200) + "...";
                    }
                    callback.onSearchComplete(cleanResult);
                }
            });
        }
    }
    
    public void cleanup() {
        if (webView != null) {
            mainHandler.post(() -> {
                try {
                    webView.stopLoading();
                    webView.clearCache(true);
                    webView.clearHistory();
                    Log.i(TAG, "WebView cleaned up");
                } catch (Exception e) {
                    Log.e(TAG, "Error cleaning up WebView", e);
                }
            });
        }
    }
}
