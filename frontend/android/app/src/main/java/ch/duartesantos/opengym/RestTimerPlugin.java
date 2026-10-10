package ch.duartesantos.opengym;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "RestTimer")
public class RestTimerPlugin extends Plugin {
    @PluginMethod
    public void start(PluginCall call) {
        Long endsAt = call.getLong("endsAt");
        if (endsAt == null || endsAt <= 0) {
            call.reject("A rest end timestamp is required");
            return;
        }
        JSObject result = new JSObject();
        result.put("handled", RestTimerNotifications.start(getContext(), endsAt,
            call.getString("title", "Rest"), call.getString("body", "Rest over — next set!"),
            call.getBoolean("sound", true), call.getInt("total", 1)));
        call.resolve(result);
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        RestTimerNotifications.cancel(getContext());
        call.resolve();
    }

    @PluginMethod
    public void finish(PluginCall call) {
        JSObject result = new JSObject();
        result.put("handled", RestTimerNotifications.finish(getContext(), call.getLong("endsAt", 0L)));
        call.resolve(result);
    }

    @PluginMethod
    public void getState(PluginCall call) {
        JSObject result = new JSObject();
        long endsAt = RestTimerNotifications.endsAt(getContext());
        if (endsAt > System.currentTimeMillis()) {
            JSObject timer = new JSObject();
            timer.put("endsAt", endsAt);
            timer.put("total", RestTimerNotifications.total(getContext()));
            result.put("timer", timer);
        }
        call.resolve(result);
    }
}
