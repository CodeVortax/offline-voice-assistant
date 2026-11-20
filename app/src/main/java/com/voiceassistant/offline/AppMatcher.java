package com.voiceassistant.offline;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;

import java.util.ArrayList;
import java.util.List;

/** Finds an installed app from a spoken (possibly mispronounced) name. */
public class AppMatcher {

    public static final double THRESHOLD = 0.62;

    public static class App {
        public final String label;
        public final String pkg;
        App(String label, String pkg) { this.label = label; this.pkg = pkg; }
    }

    public static class Match {
        public final App app;
        public final double score;
        Match(App app, double score) { this.app = app; this.score = score; }
    }

    private final Context context;
    private final List<App> apps = new ArrayList<>();
    private long loadedAt = 0;

    public AppMatcher(Context context) {
        this.context = context.getApplicationContext();
    }

    private synchronized void load(boolean force) {
        long now = System.currentTimeMillis();
        if (!force && !apps.isEmpty() && now - loadedAt < 60_000) return;
        apps.clear();
        PackageManager pm = context.getPackageManager();
        Intent main = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER);
        for (ResolveInfo ri : pm.queryIntentActivities(main, 0)) {
            try {
                String label = ri.loadLabel(pm).toString();
                String pkg = ri.activityInfo.packageName;
                if (pkg.equals(context.getPackageName())) continue;
                apps.add(new App(label, pkg));
            } catch (Exception ignored) { }
        }
        loadedAt = now;
    }

    /** @return the best installed app for what was said, or null if nothing is close enough. */
    public synchronized Match find(String spoken) {
        load(false);
        Match m = best(spoken);
        if (m == null) {            // app may have just been installed
            load(true);
            m = best(spoken);
        }
        return m;
    }

    private Match best(String spoken) {
        App bestApp = null;
        double bestScore = 0;
        for (App a : apps) {
            double s = Fuzzy.score(spoken, a.label);
            if (s > bestScore) { bestScore = s; bestApp = a; }
        }
        return (bestApp != null && bestScore >= THRESHOLD) ? new Match(bestApp, bestScore) : null;
    }
}
