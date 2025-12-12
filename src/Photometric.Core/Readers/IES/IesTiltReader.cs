using System.Globalization;

namespace Photometric.Core.Readers.IES;

/// <summary>
/// Reads and applies IES LM-63 TILT=INCLUDE data.
/// Notes:
/// - TILT=INCLUDE appears immediately after the TILT line, BEFORE the numeric photometric header line.
/// - The tilt table provides multipliers vs. angles (degrees).
/// - To correct candela values, we interpolate multipliers at each vertical angle (Gamma) and
///   apply per-vertical-angle scaling to the candela matrix.
/// </summary>
public static class IesTiltReader
{
    public sealed class TiltIncludeData
    {
        public IReadOnlyList<double> Angles { get; init; } = Array.Empty<double>();
        public IReadOnlyList<double> Multipliers { get; init; } = Array.Empty<double>();
    }

    /// <summary>
    /// Reads the TILT=INCLUDE block starting at current index (the line right after "TILT=INCLUDE").
    /// Advances index to the first line AFTER the include block.
    /// </summary>
    public static TiltIncludeData ReadInclude(string[] lines, ref int index)
    {
        if (index >= lines.Length)
            throw new FormatException("Unexpected end of file while reading TILT=INCLUDE.");

        // First token after TILT=INCLUDE is number of tilt angles
        var nTokens = SplitTokens(lines[index]);
        if (nTokens.Length < 1)
            throw new FormatException("Invalid TILT=INCLUDE angle count line.");

        int n = ParseInt(nTokens[0]);
        index++;

        if (n <= 0)
            throw new FormatException("Invalid TILT=INCLUDE angle count.");

        var angles = ReadDoubles(lines, ref index, n);
        var multipliers = ReadDoubles(lines, ref index, n);

        return new TiltIncludeData
        {
            Angles = angles,
            Multipliers = multipliers
        };
    }

    /// <summary>
    /// Builds per-vertical-angle multipliers by linear interpolation from the tilt table.
    /// Clamp to endpoints outside the tilt angle range.
    /// </summary>
    public static double[] BuildVerticalMultipliers(
        IReadOnlyList<double> verticalAngles,
        IReadOnlyList<double> tiltAngles,
        IReadOnlyList<double> tiltMultipliers)
    {
        if (tiltAngles.Count != tiltMultipliers.Count || tiltAngles.Count == 0)
            throw new ArgumentException("Tilt angle/multiplier table is invalid.");

        var result = new double[verticalAngles.Count];

        for (int i = 0; i < verticalAngles.Count; i++)
        {
            double x = verticalAngles[i];
            result[i] = InterpClamp(tiltAngles, tiltMultipliers, x);
        }

        return result;
    }

    /// <summary>
    /// Applies per-vertical multipliers to candela matrix in-place:
    /// candela[h, v] *= verticalMultiplier[v]
    /// </summary>
    public static void ApplyToCandela(double[,] candela, double[] verticalMultipliers)
    {
        int hCount = candela.GetLength(0);
        int vCount = candela.GetLength(1);

        if (verticalMultipliers.Length != vCount)
            throw new ArgumentException("Vertical multiplier length does not match candela matrix.");

        for (int h = 0; h < hCount; h++)
        {
            for (int v = 0; v < vCount; v++)
            {
                candela[h, v] *= verticalMultipliers[v];
            }
        }
    }

    // ---------------- helpers ----------------

    private static string[] SplitTokens(string line)
        => line.Split(' ', StringSplitOptions.RemoveEmptyEntries);

    private static List<double> ReadDoubles(string[] lines, ref int index, int count)
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

    private static int ParseInt(string s)
        => int.Parse(s, CultureInfo.InvariantCulture);

    private static double ParseDouble(string s)
        => double.Parse(s, CultureInfo.InvariantCulture);

    private static double InterpClamp(IReadOnlyList<double> xs, IReadOnlyList<double> ys, double x)
    {
        // Assumes xs are in ascending order (common in IES tilt tables).
        // If not strictly sorted, this will still behave reasonably for monotonic-ish data.
        if (x <= xs[0]) return ys[0];
        if (x >= xs[^1]) return ys[^1];

        // Find segment [i, i+1] such that xs[i] <= x <= xs[i+1]
        // Linear scan is OK for typical small tables; can optimize later if needed.
        for (int i = 0; i < xs.Count - 1; i++)
        {
            double x0 = xs[i];
            double x1 = xs[i + 1];

            if (x >= x0 && x <= x1)
            {
                double y0 = ys[i];
                double y1 = ys[i + 1];

                if (Math.Abs(x1 - x0) < 1e-12)
                    return y0;

                double t = (x - x0) / (x1 - x0);
                return y0 + (y1 - y0) * t;
            }
        }

        // Fallback (should not happen if xs monotonic)
        return ys[^1];
    }
}
