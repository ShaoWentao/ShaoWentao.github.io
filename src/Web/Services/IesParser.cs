using System.Globalization;

namespace Web.Services;

public static class IesParser
{
    public static IesData Parse(string iesText)
    {
        var lines = iesText
            .Split('\n', StringSplitOptions.RemoveEmptyEntries)
            .Select(l => l.Trim())
            .ToList();

        // 跳过 HEADER，找到 TILT
        int index = lines.FindIndex(l => l.StartsWith("TILT=", StringComparison.OrdinalIgnoreCase));
        index++;

        // 读取关键参数行
        var header = lines[index++]
            .Split(' ', StringSplitOptions.RemoveEmptyEntries)
            .Select(s => double.Parse(s, CultureInfo.InvariantCulture))
            .ToArray();

        int verticalCount = (int)header[3];
        int horizontalCount = (int)header[4];
        int photometricType = (int)header[5];

        if (photometricType != 1)
            throw new Exception("Only Type C photometry is supported.");

        // 垂直角
        var verticalAngles = ReadNumbers(lines, ref index, verticalCount);

        // 水平角（暂时只用第一个）
        var horizontalAngles = ReadNumbers(lines, ref index, horizontalCount);

        // Candela values
        var candela = new double[horizontalCount, verticalCount];

        for (int h = 0; h < horizontalCount; h++)
        {
            var values = ReadNumbers(lines, ref index, verticalCount);
            for (int v = 0; v < verticalCount; v++)
                candela[h, v] = values[v];
        }

        // Peak candela
        double peak = 0;
        foreach (var v in candela)
            peak = Math.Max(peak, v);

        // Beam angle (50%)
        double half = peak * 0.5;
        double? left = null, right = null;

        for (int i = 0; i < verticalCount; i++)
        {
            var value = candela[0, i];
            if (value >= half)
            {
                left ??= verticalAngles[i];
                right = verticalAngles[i];
            }
        }

        return new IesData
        {
            VerticalAngles = verticalAngles,
            Candela = candela,
            PeakCandela = peak,
            BeamAngle = (right ?? 0) - (left ?? 0)
        };
    }

    private static double[] ReadNumbers(List<string> lines, ref int index, int count)
    {
        var result = new List<double>();

        while (result.Count < count)
        {
            var parts = lines[index++]
                .Split(' ', StringSplitOptions.RemoveEmptyEntries);

            foreach (var p in parts)
                result.Add(double.Parse(p, CultureInfo.InvariantCulture));
        }

        return result.Take(count).ToArray();
    }
}
