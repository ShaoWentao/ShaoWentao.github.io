using System.Globalization;
using Photometric.Core.Models.Common;
using Photometric.Core.Models.IES;

namespace Photometric.Core.Readers.IES;

/// <summary>
/// Reads IES: header + angles + candela matrix (no tilt correction applied yet).
/// </summary>
public static class IesHeaderReader
{
    public static IesParseResult Parse(string iesText)
    {
        if (string.IsNullOrWhiteSpace(iesText))
            throw new ArgumentException("IES text is empty.");

        var lines = iesText
            .Replace("\r", string.Empty)
            .Split('\n', StringSplitOptions.RemoveEmptyEntries);

        int index = 0;

        var common = new PhotometricHeader();
        var iesHeader = new IesHeader();
        var tilt = new IesTilt();

        // ------------------------------------------------------------------
        // 1) IES version (first line)
        // ------------------------------------------------------------------
        if (index >= lines.Length)
            throw new FormatException("Missing IES version line.");

        iesHeader = iesHeader with { IesVersion = lines[index].Trim() };
        index++;

        // ------------------------------------------------------------------
        // 2) Keyword section until TILT=
        // ------------------------------------------------------------------
        while (index < lines.Length)
        {
            var line = lines[index].Trim();

            if (line.StartsWith("TILT=", StringComparison.OrdinalIgnoreCase))
                break;

            if (line.StartsWith("[") && line.Contains(']'))
            {
                var end = line.IndexOf(']');
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
                    "MORE" => common with { Notes = value },
                    _ => common
                };
            }

            index++;
        }

        // ------------------------------------------------------------------
        // 3) TILT line
        // ------------------------------------------------------------------
        if (index >= lines.Length || !lines[index].StartsWith("TILT=", StringComparison.OrdinalIgnoreCase))
            throw new FormatException("Missing TILT line.");

        {
            var tiltValue = lines[index][5..].Trim();

            if (tiltValue.Equals("NONE", StringComparison.OrdinalIgnoreCase))
            {
                tilt = tilt with { Type = "NONE" };
            }
            else if (tiltValue.Equals("INCLUDE", StringComparison.OrdinalIgnoreCase))
            {
                tilt = tilt with { Type = "INCLUDE" };
            }
            else
            {
                tilt = tilt with { Type = "FILE", FileName = tiltValue };
            }

            index++;
        }

        // ------------------------------------------------------------------
        // 4) Photometric numeric header line (LM-63 core line)
        // Format (typical LM-63):
        // 0: #lamps
        // 1: lumens per lamp
        // 2: candela multiplier
        // 3: #vertical angles (Nv)
        // 4: #horizontal angles (Nh)
        // 5: photometric type (1=C,2=B,3=A)
        // 6: units type (1=feet,2=meters)
        // 7: width
        // 8: length
        // 9: height
        // 10: ballast factor
        // 11: future use
        // 12: input watts
        // ------------------------------------------------------------------
        if (index >= lines.Length)
            throw new FormatException("Missing photometric header numeric line.");

        var tokens = SplitTokens(lines[index]);
        if (tokens.Length < 10)
            throw new FormatException("Invalid photometric header numeric line (too few fields).");

        int lampCount = ParseInt(tokens[0]);
        double lumensPerLamp = ParseDouble(tokens[1]);
        double candelaMultiplier = ParseDouble(tokens[2]);

        int verticalCount = tokens.Length > 3 ? ParseInt(tokens[3]) : 0;
        int horizontalCount = tokens.Length > 4 ? ParseInt(tokens[4]) : 0;

        int photometricType = tokens.Length > 5 ? ParseInt(tokens[5]) : 1;
        int unitsType = tokens.Length > 6 ? ParseInt(tokens[6]) : 2;

        double width = tokens.Length > 7 ? ParseDouble(tokens[7]) : 0;
        double length = tokens.Length > 8 ? ParseDouble(tokens[8]) : 0;
        double height = tokens.Length > 9 ? ParseDouble(tokens[9]) : 0;

        double ballastFactor = tokens.Length > 10 ? ParseDouble(tokens[10]) : 1.0;

        // Input watts is usually token[12], but some variants place it as the last token.
        double inputWatts =
            tokens.Length > 12 ? ParseDouble(tokens[12]) :
            tokens.Length > 0 ? ParseDouble(tokens[^1]) : 0;

        var photometry = new IesPhotometry
        {
            LampCount = lampCount,
            LumensPerLamp = lumensPerLamp,
            CandelaMultiplier = candelaMultiplier,
            PhotometricType = photometricType,
            UnitsType = unitsType,
            BallastFactor = ballastFactor,
            InputWatts = inputWatts
        };

        iesHeader = iesHeader with
        {
            Tilt = tilt,
            Photometry = photometry,
        };

        common = common with
        {
            InputWatts = photometry.InputWatts,
            TotalLumens = photometry.LampCount * photometry.LumensPerLamp
        };

        index++;

        if (verticalCount <= 0 || horizontalCount <= 0)
            throw new FormatException("Invalid angle counts in photometric header line.");

        // ------------------------------------------------------------------
        // 5) Read vertical angles (Nv)
        // ------------------------------------------------------------------
        var verticalAngles = ReadDoubles(lines, ref index, verticalCount);

        // ------------------------------------------------------------------
        // 6) Read horizontal angles (Nh)
        // ------------------------------------------------------------------
        var horizontalAngles = ReadDoubles(lines, ref index, horizontalCount);

        var angles = new PhotometricAngles
        {
            Vertical = verticalAngles,
            Horizontal = horizontalAngles,
            Type = photometricType switch
            {
                1 => "C",
                2 => "B",
                3 => "A",
                _ => "C"
            }
        };

        // ------------------------------------------------------------------
        // 7) Read candela values (Nh * Nv) and build matrix [H, V]
        // Note: We apply candela multiplier here.
        // Tilt correction (TILT=INCLUDE/FILE) will be a later phase.
        // ------------------------------------------------------------------
        int candelaCount = checked(horizontalCount * verticalCount);
        var candelaFlat = ReadDoubles(lines, ref index, candelaCount);

        var candelaMatrix = new double[horizontalCount, verticalCount];
        int k = 0;
        for (int h = 0; h < horizontalCount; h++)
        {
            for (int v = 0; v < verticalCount; v++)
            {
                candelaMatrix[h, v] = candelaFlat[k++] * candelaMultiplier;
            }
        }

        var candela = new CandelaMatrix
        {
            Values = candelaMatrix
        };

        return new IesParseResult
        {
            CommonHeader = common,
            IesHeader = iesHeader,
            Angles = angles,
            Candela = candela
        };
    }

    // ======================================================================
    // Helpers
    // ======================================================================

    private static string[] SplitTokens(string line)
        => line.Split(' ', StringSplitOptions.RemoveEmptyEntries);

    private static IReadOnlyList<double> ReadDoubles(string[] lines, ref int index, int count)
    {
        var list = new List<double>(count);

        while (list.Count < count && index < lines.Length)
        {
            var tokens = SplitTokens(lines[index]);
            foreach (var token in tokens)
            {
                if (list.Count < count)
                    list.Add(ParseDouble(token));
            }
            index++;
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
