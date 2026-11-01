// Compile with .NET Framework csc /target:library /reference:System.Web.Extensions.dll.
// No request headers, account data, comments, or raw response bodies are persisted.
using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using System.Web.Script.Serialization;

public static class MeowzartCapture
{
    public static string Sanitize(string body, string endpoint, int status)
    {
        var json = new JavaScriptSerializer { MaxJsonLength = 4194304 };
        var records = new List<object>();
        var keys = new List<string>();
        var result = new Dictionary<string, object> {
            {"captured_at_utc", DateTime.UtcNow.ToString("o")},
            {"endpoint", endpoint}, {"http_status", status}, {"society_id", 1},
            {"records", records}, {"first_record_keys", keys},
            {"image_capture_time_known", false}
        };
        if (status == 200) {
            var root = json.DeserializeObject(body) as Dictionary<string, object>;
            if (root == null) throw new FormatException();
            object response;
            if (!root.TryGetValue("response", out response)) throw new FormatException();
            result["errno"] = Get(root, "errno");
            var rows = response as object[] ?? new object[] { response };
            result["response_record_count"] = rows.Length;
            foreach (var entry in rows) {
                var row = entry as Dictionary<string, object>;
                if (row == null) continue;
                if (keys.Count == 0) keys.AddRange(row.Keys);
                if (Convert.ToString(Get(row, "societyId")) != "1" ||
                    Convert.ToString(Get(row, "category")) != "cat") continue;
                var record = new Dictionary<string, object>();
                foreach (var field in new[] {"petId", "societyId", "category", "name", "avatar"})
                    record[field] = Get(row, field);
                var photos = new List<string>();
                var info = Get(row, "info") as Dictionary<string, object>;
                var urls = info == null ? null : Get(info, "photos") as object[];
                if (urls != null) foreach (var value in urls) {
                    var url = value as string;
                    if (url != null && url.StartsWith("https://", StringComparison.Ordinal)) photos.Add(url);
                }
                record["photos"] = photos;
                records.Add(record);
            }
        }
        return json.Serialize(result);
    }

    private static object Get(Dictionary<string, object> row, string key) {
        object value;
        return row.TryGetValue(key, out value) ? value : null;
    }

    public static void Capture(string body, string endpoint, int status, string directory, int sessionId) {
        var output = Sanitize(body, endpoint, status);
        Directory.CreateDirectory(directory);
        var path = Path.Combine(directory, "response-" + DateTime.UtcNow.ToString("yyyyMMddTHHmmssfff") + "-" + sessionId + ".json");
        File.WriteAllText(path, output, new UTF8Encoding(false));
    }
}
