// Insert into Handlers in existing Fiddler Classic JScript.NET rules.
// Compile MeowzartCapture.cs and replace both JScript-escaped path placeholders.
static function MeowzartBeforeRequest(s: Session) {
    if (!s.HostnameIs("api.meowzart.com")) {
        if (s.HTTPMethodIs("CONNECT")) s["x-no-decrypt"] = "outside collection scope";
        s.Ignore();
        return;
    }
    s["log-drop-request-body"] = "true";
    if (!s.HTTPMethodIs("CONNECT")) {
        var p = new System.Uri(s.fullUrl).AbsolutePath;
        if (!s.HTTPMethodIs("GET") || (p != "/api/v1/pet/society/list" &&
            !System.Text.RegularExpressions.Regex.IsMatch(p, "^/api/v1/pet/[1-9][0-9]*$"))) s.Ignore();
    }
}
static function MeowzartResponse(s: Session) {
    if (!s.HostnameIs("api.meowzart.com") || !s.HTTPMethodIs("GET")) return;
    var uri = new System.Uri(s.fullUrl);
    var path = uri.AbsolutePath;
    var isList = path == "/api/v1/pet/society/list";
    if (!isList && !System.Text.RegularExpressions.Regex.IsMatch(path, "^/api/v1/pet/[1-9][0-9]*$")) return;
    if (isList && !System.Text.RegularExpressions.Regex.IsMatch(uri.Query, "[?&]societyId=1(&|$)")) return;
    s.oRequest.headers.Remove("Authorization");
    s.oRequest.headers.Remove("Cookie");
    try {
        var helper = System.Reflection.Assembly.LoadFrom("__HELPER_DLL__").GetType("MeowzartCapture");
        var arguments = new Object[5];
        arguments[0] = s.GetResponseBodyAsString();
        arguments[1] = path + (isList ? uri.Query : "");
        arguments[2] = s.responseCode;
        arguments[3] = "__OUTPUT_DIRECTORY__";
        arguments[4] = s.id;
        helper.InvokeMember("Capture", System.Reflection.BindingFlags.InvokeMethod, null, null, arguments);
        FiddlerApplication.Log.LogString("Meowzart scoped response saved.");
    } catch (e) {
        FiddlerApplication.Log.LogString("Meowzart capture failed; exception type=" + e.GetType().FullName);
    }
}
