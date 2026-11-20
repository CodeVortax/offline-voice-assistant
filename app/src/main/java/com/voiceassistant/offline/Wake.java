package com.voiceassistant.offline;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

/** Wake-word detection that tolerates the many ways speech recognisers spell "Vicky". */
public final class Wake {

    private Wake() {}

    private static final Set<String> ALIASES = new HashSet<>(Arrays.asList(
            "vicky", "vickey", "vickie", "vicki", "vikki", "viki", "vikky", "vikkie", "vikey",
            "wiki", "wicky", "wikki", "becky", "bicky", "vigi", "vickys", "vickeys"));

    private static final Set<String> GREETINGS = new HashSet<>(Arrays.asList(
            "hey", "hi", "hello", "ok", "okay", "yo", "oh", "ya", "yeah", "please"));

    /**
     * @return null if no wake word was heard, "" if only the wake word was said,
     *         otherwise the command that came with it ("Vicky open youtube" or "open youtube Vicky").
     */
    public static String extractCommand(String text) {
        if (text == null) return null;
        String[] tokens = text.toLowerCase(Locale.ROOT).replaceAll("[^\\p{L}\\p{N}\\s]", " ").trim().split("\\s+");
        for (int i = 0; i < tokens.length; i++) {
            int used = 0;
            if (ALIASES.contains(tokens[i])) used = 1;
            else if (i + 1 < tokens.length && ALIASES.contains(tokens[i] + tokens[i + 1])) used = 2;
            if (used == 0) continue;

            String after = join(tokens, i + used, tokens.length);
            if (!after.isEmpty()) return after;
            // wake word was last: "open youtube vicky"
            String before = stripGreetings(join(tokens, 0, i));
            return before;
        }
        return null;
    }

    private static String stripGreetings(String s) {
        String[] t = s.isEmpty() ? new String[0] : s.split(" ");
        int start = 0;
        while (start < t.length && GREETINGS.contains(t[start])) start++;
        return join(t, start, t.length);
    }

    private static String join(String[] t, int from, int to) {
        StringBuilder sb = new StringBuilder();
        for (int i = from; i < to; i++) {
            if (t[i].isEmpty()) continue;
            if (sb.length() > 0) sb.append(' ');
            sb.append(t[i]);
        }
        return sb.toString();
    }
}
