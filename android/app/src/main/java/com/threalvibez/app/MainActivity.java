package com.threalvibez.app;

import android.Manifest;
import android.app.Dialog;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.os.Build;
import android.os.Bundle;
import android.os.Message;
import android.view.ViewGroup;
import android.view.Window;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;
import com.google.android.gms.auth.api.signin.GoogleSignIn;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;
import com.google.android.gms.auth.api.signin.GoogleSignInClient;
import com.google.android.gms.auth.api.signin.GoogleSignInOptions;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.tasks.Task;

public class MainActivity extends BridgeActivity {

    private static final int RC_SIGN_IN = 9001;
    private static final int PERMISSION_REQUEST_CODE = 101;
    private static final int FILE_CHOOSER_REQUEST_CODE = 2001;
    private WebView mainWebView;
    private GoogleSignInClient mGoogleSignInClient;
    private android.webkit.ValueCallback<android.net.Uri[]> mFilePathCallback;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        createNotificationChannels();
        setupGoogleNativeAuth();
        setupWebView();
        requestAndroidPermissions();
    }

    // ── 1. Request Runtime Permissions (Notifications, Camera, Audio) ─────────
    private void requestAndroidPermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(
                    this,
                    new String[]{
                        Manifest.permission.POST_NOTIFICATIONS,
                        Manifest.permission.CAMERA,
                        Manifest.permission.RECORD_AUDIO
                    },
                    PERMISSION_REQUEST_CODE
                );
            }
        }
    }

    // ── 2. Configure Native Google Sign-In ─────────────────────────────────────
    private void setupGoogleNativeAuth() {
        try {
            GoogleSignInOptions gso = new GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
                .requestIdToken("1003230563610-hilqtdtlqpujrkp3j0oc61tg0aq86mmn.apps.googleusercontent.com")
                .requestEmail()
                .build();
            mGoogleSignInClient = GoogleSignIn.getClient(this, gso);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    // JavaScript interface exposed to web view for native Google Sign-In
    public class NativeAuthInterface {
        @JavascriptInterface
        public void triggerNativeGoogleSignIn() {
            runOnUiThread(() -> {
                if (mGoogleSignInClient != null) {
                    // Sign out previous cache to ensure account picker dialog appears
                    mGoogleSignInClient.signOut().addOnCompleteListener(task -> {
                        Intent signInIntent = mGoogleSignInClient.getSignInIntent();
                        startActivityForResult(signInIntent, RC_SIGN_IN);
                    });
                }
            });
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILE_CHOOSER_REQUEST_CODE) {
            if (mFilePathCallback == null) return;
            android.net.Uri[] results = null;
            if (resultCode == RESULT_OK && data != null) {
                String dataString = data.getDataString();
                if (dataString != null) {
                    results = new android.net.Uri[]{android.net.Uri.parse(dataString)};
                } else if (data.getClipData() != null) {
                    final int count = data.getClipData().getItemCount();
                    results = new android.net.Uri[count];
                    for (int i = 0; i < count; i++) {
                        results[i] = data.getClipData().getItemAt(i).getUri();
                    }
                }
            }
            mFilePathCallback.onReceiveValue(results);
            mFilePathCallback = null;
            return;
        }

        if (requestCode == RC_SIGN_IN) {
            Task<GoogleSignInAccount> task = GoogleSignIn.getSignedInAccountFromIntent(data);
            WebView targetWebView = (this.bridge != null && this.bridge.getWebView() != null) ? this.bridge.getWebView() : mainWebView;
            try {
                GoogleSignInAccount account = task.getResult(ApiException.class);
                if (account != null && account.getIdToken() != null) {
                    String idToken = account.getIdToken();
                    // Pass native Google ID Token back into web app JavaScript
                    if (targetWebView != null) {
                        targetWebView.post(() -> {
                            targetWebView.evaluateJavascript(
                                "if(window.handleNativeGoogleSignIn){ window.handleNativeGoogleSignIn('" + idToken + "'); }",
                                null
                            );
                        });
                    }
                } else {
                    if (targetWebView != null) {
                        targetWebView.post(() -> {
                            targetWebView.evaluateJavascript(
                                "if(window.handleNativeGoogleSignInError){ window.handleNativeGoogleSignInError('No ID token'); }",
                                null
                            );
                        });
                    }
                }
            } catch (ApiException e) {
                System.err.println("[Native Google Auth] Sign in failed code: " + e.getStatusCode());
                if (targetWebView != null) {
                    final int code = e.getStatusCode();
                    targetWebView.post(() -> {
                        targetWebView.evaluateJavascript(
                            "if(window.handleNativeGoogleSignInError){ window.handleNativeGoogleSignInError('ApiException " + code + "'); }",
                            null
                        );
                    });
                }
            }
        }
    }

    // ── 3. Configure Android Notification Channels ────────────────────────────
    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;

        // Messages channel (High priority heads-up banner)
        NotificationChannel messages = new NotificationChannel(
            "messages",
            "Messages",
            NotificationManager.IMPORTANCE_HIGH
        );
        messages.setDescription("Notifications for new chat messages");
        messages.enableVibration(true);
        messages.setShowBadge(true);
        nm.createNotificationChannel(messages);

        // Calls channel (High priority + bypass DND for full screen calls)
        NotificationChannel calls = new NotificationChannel(
            "calls",
            "Incoming Calls",
            NotificationManager.IMPORTANCE_HIGH
        );
        calls.setDescription("Incoming voice and video call alerts");
        calls.enableVibration(true);
        calls.setBypassDnd(true);
        calls.setShowBadge(false);
        nm.createNotificationChannel(calls);

        // Stories channel
        NotificationChannel stories = new NotificationChannel(
            "stories",
            "Stories",
            NotificationManager.IMPORTANCE_DEFAULT
        );
        stories.setDescription("Notifications when friends post new stories");
        stories.enableVibration(false);
        stories.setShowBadge(true);
        nm.createNotificationChannel(stories);
    }

    // ── 4. Configure WebView Settings & Prevent Background Freezing ──────────
    private void setupWebView() {
        try {
            WebView wv = (this.bridge != null) ? this.bridge.getWebView() : null;
            if (wv == null) {
                // Retry setup until bridge and WebView are ready
                new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(this::setupWebView, 300);
                return;
            }

            mainWebView = wv;
            WebSettings settings = mainWebView.getSettings();

            settings.setDomStorageEnabled(true);
            settings.setDatabaseEnabled(true);
            settings.setSupportMultipleWindows(true);
            settings.setJavaScriptCanOpenWindowsAutomatically(true);
            settings.setMediaPlaybackRequiresUserGesture(false);

            // Bind native JavaScript interface
            mainWebView.addJavascriptInterface(new NativeAuthInterface(), "AndroidNativeAuth");

            mainWebView.setWebChromeClient(new WebChromeClient() {
                @Override
                public boolean onShowFileChooser(WebView webView, android.webkit.ValueCallback<android.net.Uri[]> filePathCallback, FileChooserParams fileChooserParams) {
                    if (mFilePathCallback != null) {
                        mFilePathCallback.onReceiveValue(null);
                    }
                    mFilePathCallback = filePathCallback;

                    try {
                        Intent intent = fileChooserParams.createIntent();
                        startActivityForResult(intent, FILE_CHOOSER_REQUEST_CODE);
                    } catch (ActivityNotFoundException e) {
                        mFilePathCallback = null;
                        return false;
                    }
                    return true;
                }

                @Override
                public void onPermissionRequest(final android.webkit.PermissionRequest request) {
                    MainActivity.this.runOnUiThread(() -> {
                        request.grant(request.getResources());
                    });
                }

                @Override
                public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, Message resultMsg) {
                    WebView popupWebView = new WebView(MainActivity.this);
                    popupWebView.setLayoutParams(new FrameLayout.LayoutParams(
                            ViewGroup.LayoutParams.MATCH_PARENT,
                            ViewGroup.LayoutParams.MATCH_PARENT
                    ));

                    WebSettings ps = popupWebView.getSettings();
                    ps.setJavaScriptEnabled(true);
                    ps.setDomStorageEnabled(true);
                    ps.setSupportMultipleWindows(true);
                    ps.setUserAgentString(
                        "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 " +
                        "(KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36"
                    );

                    Dialog popupDialog = new Dialog(MainActivity.this, android.R.style.Theme_Black_NoTitleBar_Fullscreen);
                    popupDialog.requestWindowFeature(Window.FEATURE_NO_TITLE);
                    popupDialog.setContentView(popupWebView);

                    popupWebView.setWebViewClient(new WebViewClient() {
                        @Override
                        public void onPageStarted(WebView wv, String url, Bitmap favicon) {
                            if (url != null && url.contains("/__/auth/handler")) {
                                mainWebView.evaluateJavascript(
                                    "(function(){" +
                                    "  var ss={};" +
                                    "  for(var i=0;i<sessionStorage.length;i++){" +
                                    "    var k=sessionStorage.key(i);" +
                                    "    ss[k]=sessionStorage.getItem(k);" +
                                    "  }" +
                                    "  return JSON.stringify(ss);" +
                                    "})()",
                                    parentSessionStorage -> {
                                        if (parentSessionStorage != null && !parentSessionStorage.equals("null") && !parentSessionStorage.equals("\"\"")) {
                                            String injectScript =
                                                "(function(data){" +
                                                "  try{" +
                                                "    var ss=JSON.parse(data);" +
                                                "    Object.keys(ss).forEach(function(k){" +
                                                "      sessionStorage.setItem(k,ss[k]);" +
                                                "    });" +
                                                "  }catch(e){console.error('[Auth Bridge] inject failed',e);}" +
                                                "})('" + parentSessionStorage.replace("'", "\\'") + "')";
                                            wv.evaluateJavascript(injectScript, null);
                                        }
                                    }
                                );
                            }
                        }

                        @Override
                        public boolean shouldOverrideUrlLoading(WebView wv, WebResourceRequest req) {
                            return false;
                        }
                    });

                    popupWebView.setWebChromeClient(new WebChromeClient() {
                        @Override
                        public void onCloseWindow(WebView window) {
                            popupDialog.dismiss();
                        }
                    });

                    WebView.WebViewTransport transport = (WebView.WebViewTransport) resultMsg.obj;
                    transport.setWebView(popupWebView);
                    resultMsg.sendToTarget();

                    popupDialog.show();
                    return true;
                }
            });

        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    // ── 5. Un-freeze WebView & Firebase WebSockets on App Resume ──────────────
    @Override
    public void onResume() {
        super.onResume();
        if (mainWebView != null) {
            mainWebView.onResume();
            mainWebView.resumeTimers();
        }
    }

    @Override
    public void onPause() {
        super.onPause();
        if (mainWebView != null) {
            mainWebView.pauseTimers();
        }
    }
}
