package com.voiceassistant.offline;

import java.util.Locale;

/** Pure-Java fuzzy matching helpers (no Android deps) used for app names and the wake word. */
public final class Fuzzy {

    private Fuzzy() {}

    /** Lowercase, strip punctuation, drop filler words like "app". */
    public static String normalize(String s) {
        if (s == null) return "";
        String t = s.toLowerCase(Locale.ROOT).replace("&", " and ").replace("'", "").replace("\u2019", "");
        t = t.replaceAll("[^\\p{L}\\p{N}]+", " ").trim();
        StringBuilder sb = new StringBuilder();
        for (String tok : t.split(" ")) {
            if (tok.isEmpty() || tok.equals("app") || tok.equals("application") || tok.equals("the")) continue;
            if (sb.length() > 0) sb.append(' ');
            sb.append(tok);
        }
        return sb.toString();
    }

    /** Rough consonant skeleton so "musicalet" and "musicolet" collapse to the same key. */
    public static String phonetic(String s) {
        String t = s.toLowerCase(Locale.ROOT).replaceAll("[^\\p{L}\\p{N}]", "");
        t = t.replace("ph", "f").replace("ck", "k").replace("kn", "n").replace("wr", "r").replace("sch", "sk");
        StringBuilder sb = new StringBuilder();
        char prev = 0;
        for (int i = 0; i < t.length(); i++) {
            char c = t.charAt(i);
            char next = i + 1 < t.length() ? t.charAt(i + 1) : 0;
            String out;
            switch (c) {
                case 'c': out = (next == 'e' || next == 'i' || next == 'y') ? "s" : "k"; break;
                case 'q': out = "k"; break;
                case 'x': out = "ks"; break;
                case 'z': out = "s"; break;
                case 'h': out = ""; break;
                case 'a': case 'e': case 'i': case 'o': case 'u': case 'y':
                    out = (i == 0) ? String.valueOf(c) : ""; break;
                default: out = String.valueOf(c);
            }
            for (int k = 0; k < out.length(); k++) {
                char oc = out.charAt(k);
                if (oc != prev) sb.append(oc);
                prev = oc;
            }
            if (out.isEmpty()) { /* vowel dropped: keep prev so doubles around it still collapse */ }
        }
        return sb.toString();
    }

    public static int lev(String a, String b) {
        int[] prev = new int[b.length() + 1];
        int[] cur = new int[b.length() + 1];
        for (int j = 0; j <= b.length(); j++) prev[j] = j;
        for (int i = 1; i <= a.length(); i++) {
            cur[0] = i;
            for (int j = 1; j <= b.length(); j++) {
                int cost = a.charAt(i - 1) == b.charAt(j - 1) ? 0 : 1;
                cur[j] = Math.min(Math.min(cur[j - 1] + 1, prev[j] + 1), prev[j - 1] + cost);
            }
            int[] tmp = prev; prev = cur; cur = tmp;
        }
        return prev[b.length()];
    }

    /** 1.0 = identical, 0.0 = nothing in common. */
    public static double sim(String a, String b) {
        if (a.isEmpty() || b.isEmpty()) return 0;
        int max = Math.max(a.length(), b.length());
        return 1.0 - (double) lev(a, b) / max;
    }

    private static double tokenSim(String a, String b) {
        return Math.max(sim(a, b), 0.92 * sim(phonetic(a), phonetic(b)));
    }

    /** How well a spoken app name matches an app label (0..1). */
    public static double score(String spoken, String label) {
        String q = normalize(spoken), l = normalize(label);
        if (q.isEmpty() || l.isEmpty()) return 0;
        String qc = q.replace(" ", ""), lc = l.replace(" ", "");
        if (qc.equals(lc)) return 1.0;

        double best = Math.max(sim(qc, lc), 0.92 * sim(phonetic(qc), phonetic(lc)));
        if (qc.length() >= 3 && lc.startsWith(qc)) best = Math.max(best, 0.80 + 0.15 * qc.length() / lc.length());
        if (lc.length() >= 3 && qc.startsWith(lc)) best = Math.max(best, 0.75);

        String[] qt = q.split(" "), lt = l.split(" ");
        double sum = 0;
        for (String x : qt) {
            double b = 0;
            for (String y : lt) b = Math.max(b, tokenSim(x, y));
            sum += b;
        }
        double tokenScore = (sum / qt.length) * (0.75 + 0.25 * Math.min(1.0, (double) qt.length / lt.length));
        return Math.max(best, tokenScore);
    }
}
