using System.Globalization;
using Photometric.Core.Models.Common;
using Photometric.Core.Models.IES;

namespace Photometric.Core.Readers.IES;

/// <summary>
/// IES LM-63 reader (v1):
/// - Parses keywords
/// - Parses TILT line (NONE/INCLUDE/FILE) [does NOT apply tilt yet]
/// - Parses numeric photometric header
/// - Parses angles and candela matrix
/// </summary>
public static class IesReader
{
    public static IesParseResult Parse(string iesText, string? fileName = null)
    {
        if (string.IsNullOrWhiteSpace(iesText))
            throw new ArgumentException("IES text is empty.");

        var lines = iesText.Replace("\r", "")
            .Split('\n', StringSplitOptions.RemoveEmptyEntries);

        int idx = 0;

        // 1) Version
        if (idx >= lines.Length) throw new FormatException("Missing IES version line.");
        var iesHeader = new IesHeader { IesVersion = lines[idx].Trim() };
        idx++;

        // 2) Keywords until TILT=
        var common = new PhotometricHeader();

        while (idx < lines.Length)
        {
            var line = lines[idx].Trim();

            if (line.StartsWith("TILT=", StringComparison.OrdinalIgnoreCase))
                break;

            if (line.StartsWith("[") && line.Contains(']'))
            {
                int end = line.IndexOf(']');
                var key = line[1..end].ToUpperInvariant();
                var value = line[(end + 1)..].Trim();

                common = key switch
                {
                    "MANUFAC" => common with { Manufacturer = value },
                    "LUMCAT" => common with { Luminaire = value },
                    "CATALOGNUMBER" => common with { CatalogNumber = value },
                    "LAMPCAT" => common with { Lamp = value },
                    "TESTLAB" => common with { TestLaboratory = value },
                    "TEST" => common with { TestReport = value },
                    "MORE" => common with { Notes = AppendLine(common.Notes, value) },
                    _ => common
                };
            }

            idx++;
        }

        // 3) TILT
        if (idx >= lines.Length || !lines[idx].StartsWith("TILT=", StringComparison.OrdinalIgnoreCase))
            throw new FormatException("Missing TILT line.");

        var tiltValue = lines[idx][5..].Trim();
        IesTilt tilt = tiltValue.Equals("NONE", StringComparison.OrdinalIgnoreCase)
            ? new IesTilt { Type = "NONE" }
            : tiltValue.Equals("INCLUDE", StringComparison.OrdinalIgnoreCase)
                ? new IesTilt { Type = "INCLUDE" }
                : new IesTilt { Type = "FILE", FileName = tiltValue };

        idx++;

        // ✅ 新增：如果是 INCLUDE，先读倾斜表（它在光度参数行之前）
        IesTiltReader.TiltIncludeData? tiltInclude = null;
        if (tilt.Type.Equals("INCLUDE", StringComparison.OrdinalIgnoreCase))
        {
            tiltInclude = IesTiltReader.ReadInclude(lines, ref idx);
            tilt = tilt with { Angles = tiltInclude.Angles, Multipliers = tiltInclude.Multipliers };
        }

        // 4) Numeric photometric header line (LM-63 core line)
        if (idx >= lines.Length) throw new FormatException("Missing photometric header numeric line.");
        var t = SplitTokens(lines[idx]);

        // Typical LM-63 expects 13 values, but we guard by accessing safely.
        if (t.Length < 10)
            throw new FormatException("Photometric header numeric line has too few fields.");

        int lampCount = ParseInt(t[0]);
        double lumensPerLamp = ParseDouble(t[1]);
        double candelaMultiplier = ParseDouble(t[2]);

        int nv = ParseInt(t[3]);
        int nh = ParseInt(t[4]);

        int photometricType = t.Length > 5 ? ParseInt(t[5]) : 1;
        int unitsType = t.Length > 6 ? ParseInt(t[6]) : 2;

        double width = t.Length > 7 ? ParseDouble(t[7]) : 0;
        double length = t.Length > 8 ? ParseDouble(t[8]) : 0;
        double height = t.Length > 9 ? ParseDouble(t[9]) : 0;

        double ballastFactor = t.Length > 10 ? ParseDouble(t[10]) : 1;
        double futureUse = t.Length > 11 ? ParseDouble(t[11]) : 0;
        double inputWatts = t.Length > 12 ? ParseDouble(t[12]) : ParseDouble(t[^1]);

        var photometry = new IesPhotometry
        {
            LampCount = lampCount,
            LumensPerLamp = lumensPerLamp,
            CandelaMultiplier = candelaMultiplier,
            VerticalAngleCount = nv,
            HorizontalAngleCount = nh,
            PhotometricType = photometricType,
            UnitsType = unitsType,
            Width = width,
            Length = length,
            Height = height,
            BallastFactor = ballastFactor,
            FutureUse = futureUse,
            InputWatts = inputWatts
        };

        iesHeader = iesHeader with { Tilt = tilt, Photometry = photometry };
        common = common with
        {
            InputWatts = inputWatts,
            TotalLumens = lampCount * lumensPerLamp
        };

        idx++;

        if (nv <= 0 || nh <= 0)
            throw new FormatException("Invalid angle counts (Nv/Nh).");

        // 5) Vertical angles
        var vertical = ReadDoubles(lines, ref idx, nv);

        // 6) Horizontal angles
        var horizontal = ReadDoubles(lines, ref idx, nh);

        var angles = new PhotometricAngles
        {
            Vertical = vertical,
            Horizontal = horizontal,
            Type = photometricType switch
            {
                1 => "C",
                2 => "B",
                3 => "A",
                _ => "C"
            }
        };

        // 7) Candela values: Nh * Nv
        int count = checked(nh * nv);
        var flat = ReadDoubles(lines, ref idx, count);

        var matrix = new double[nh, nv];
        int k = 0;
        for (int h = 0; h < nh; h++)
            for (int v = 0; v < nv; v++)
                matrix[h, v] = flat[k++] * candelaMultiplier;

        // ✅ 新增：应用 TILT 修正（按每个垂直角插值）
        if (tiltInclude is not null)
        {
            var perV = IesTiltReader.BuildVerticalMultipliers(
                verticalAngles: angles.Vertical,
                tiltAngles: tiltInclude.Angles,
                tiltMultipliers: tiltInclude.Multipliers);

            IesTiltReader.ApplyToCandela(matrix, perV);
        }

        // ✅ 新增：计算 Peak + BeamAngle(50%)（在 Peak 所在的水平面上，左右插值）
        var (peakCandela, peakPlaneIndex, peakVerticalAngle, beamAngle) =
            ComputePeakAndBeamAngle(matrix, angles.Vertical);

        var candela = new CandelaMatrix
        {
            Values = matrix,
            PeakCandela = peakCandela,
            PeakPlaneIndex = peakPlaneIndex,
            PeakVerticalAngle = peakVerticalAngle,
            BeamAngle = beamAngle
        };

        return new IesParseResult
        {
            CommonHeader = common,
            IesHeader = iesHeader,
            Angles = angles,
            Candela = candela
        };
    }

    // ============================
    // Peak + Beam Angle (50%)
    // ============================
    private static (double peakCd, int peakPlane, double peakVAngle, double beamAngle)
        ComputePeakAndBeamAngle(double[,] values, List<double> verticalAngles)
    {
        int nh = values.GetLength(0);
        int nv = values.GetLength(1);

        if (verticalAngles.Count != nv)
            throw new ArgumentException("Vertical angles count does not match candela matrix.");

        // 1) Global peak
        double peak = 0;
        int peakPlane = 0;
        int peakV = 0;

        for (int h = 0; h < nh; h++)
        {
            for (int v = 0; v < nv; v++)
            {
                double cd = values[h, v];
                if (cd > peak)
                {
                    peak = cd;
                    peakPlane = h;
                    peakV = v;
                }
            }
        }

        double half = peak * 0.5;

        // 2) Search left crossing (toward smaller vertical index)
        double? left = null;
        for (int i = peakV; i > 0; i--)
        {
            double cNow = values[peakPlane, i];
            double cPrev = values[peakPlane, i - 1];

            if (cNow >= half && cPrev < half)
            {
                left = InterpolateAngle(
                    verticalAngles[i - 1], verticalAngles[i],
                    cPrev, cNow, half);
                break;
            }
        }

        // 3) Search right crossing (toward larger vertical index)
        double? right = null;
        for (int i = peakV; i < nv - 1; i++)
        {
            double cNow = values[peakPlane, i];
            double cNext = values[peakPlane, i + 1];

            if (cNow >= half && cNext < half)
            {
                right = InterpolateAngle(
                    verticalAngles[i], verticalAngles[i + 1],
                    cNow, cNext, half);
                break;
            }
        }

        // Fallbacks if crossing isn't found (very wide / odd data)
        double leftAngle = left ?? verticalAngles[0];
        double rightAngle = right ?? verticalAngles[^1];

        double beam = rightAngle - leftAngle;
        if (beam < 0) beam = 0; // safety

        return (peak, peakPlane, verticalAngles[peakV], beam);
    }

    private static double InterpolateAngle(
        double a1, double a2,
        double c1, double c2,
        double target)
    {
        // linear interpolation in candela domain
        double dc = c2 - c1;
        if (Math.Abs(dc) < 1e-12) return a1;
        return a1 + (target - c1) * (a2 - a1) / dc;
    }

    private static string AppendLine(string existing, string value)
        => string.IsNullOrWhiteSpace(existing) ? value : existing + "\n" + value;

    private static string[] SplitTokens(string line)
        => line.Split(' ', StringSplitOptions.RemoveEmptyEntries);

    private static List<double> ReadDoubles(string[] lines, ref int idx, int count)
    {
        var list = new List<double>(count);

        while (list.Count < count && idx < lines.Length)
        {
            var tokens = SplitTokens(lines[idx]);
            foreach (var token in tokens)
            {
                if (list.Count < count)
                    list.Add(ParseDouble(token));
            }
            idx++;
        }

        if (list.Count != count)
            throw new FormatException($"Expected {count} numeric values, got {list.Count}.");

        return list;
    }

    private static int ParseInt(string value)
        => int.Parse(value, CultureInfo.InvariantCulture);

    private static double ParseDouble(string value)
        => double.Parse(value, CultureInfo.InvariantCulture);
}
