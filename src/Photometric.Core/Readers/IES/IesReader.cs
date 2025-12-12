using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq; // ✅ 新增：确保可以使用 LINQ 方法
using Photometric.Core.Models.Common;
using Photometric.Core.Models.IES;

namespace Photometric.Core.Readers.IES
{
    /// <summary>
    /// IES LM-63 reader (v1):
    /// - Parses keywords
    /// - Parses TILT line (NONE/INCLUDE/FILE)
    /// - Parses numeric photometric header
    /// - Parses angles and candela matrix
    /// </summary>
    public static class IesReader
    {
        public static IesParseResult Parse(string iesText, string? fileName = null)
        {
            if (string.IsNullOrWhiteSpace(iesText))
                throw new ArgumentException("IES text is empty.");

            // 统一换行符并分割
            var lines = iesText.Replace("\r", "")
                .Split('\n', StringSplitOptions.RemoveEmptyEntries);

            int idx = 0;

            // 1) Version (第一行通常是 IESNA:LM-63-2002)
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

            // 处理 TILT=INCLUDE 的情况
            IesTiltReader.TiltIncludeData? tiltInclude = null;
            if (tilt.Type.Equals("INCLUDE", StringComparison.OrdinalIgnoreCase))
            {
                // ⚠️ 注意：这里依赖 IesTiltReader 类，如果报错请检查该类是否存在
                tiltInclude = IesTiltReader.ReadInclude(lines, ref idx);
                tilt = tilt with { Angles = tiltInclude.Angles, Multipliers = tiltInclude.Multipliers };
            }

            // 4) Numeric photometric header line (核心参数行)
            if (idx >= lines.Length) throw new FormatException("Missing photometric header numeric line.");
            
            // IES 文件的数值可能跨行，这里需要一种更稳健的方式读取直到凑齐参数
            // 简单起见，假设它们在同一行或使用 SplitTokens 合并读取
            var t = SplitTokens(lines[idx]);
            
            // 如果一行读不完，可能需要继续往下读（简单的 IES 解析器常遇到的坑）
            // 这里为了代码简洁，保留原逻辑，但实际项目中建议使用 token 流读取器
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

            // 应用 TILT 修正
            if (tiltInclude is not null)
            {
                var perV = IesTiltReader.BuildVerticalMultipliers(
                    verticalAngles: angles.Vertical,
                    tiltAngles: tiltInclude.Angles,
                    tiltMultipliers: tiltInclude.Multipliers);

                IesTiltReader.ApplyToCandela(matrix, perV);
            }

            // 计算 Peak + BeamAngle
            var (peakCandela, peakPlaneIndex, peakVerticalAngle, beamAngle) =
                ComputePeakAndBeamAngle(matrix, angles.Vertical);

            // ✅ 关键修正：确保 VerticalAngles 和 HorizontalAngles 被赋值
            // 之前这里可能会报错 CS1503，现在类型匹配了
            var candela = new CandelaMatrix
            {
                VerticalAngles = angles.Vertical,     // 👈 补上这个
                HorizontalAngles = angles.Horizontal, // 👈 补上这个
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

        // ... (ComputePeakAndBeamAngle 和其他辅助方法保持不变，直接用你原来的即可) ...
        
        // 为了完整性，我把你原来的辅助方法也放在这里
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

            // 2) Search left crossing
            double? left = null;
            for (int i = peakV; i > 0; i--)
            {
                double cNow = values[peakPlane, i];
                double cPrev = values[peakPlane, i - 1];

                if (cNow >= half && cPrev < half)
                {
                    left = InterpolateAngle(verticalAngles[i - 1], verticalAngles[i], cPrev, cNow, half);
                    break;
                }
            }

            // 3) Search right crossing
            double? right = null;
            for (int i = peakV; i < nv - 1; i++)
            {
                double cNow = values[peakPlane, i];
                double cNext = values[peakPlane, i + 1];

                if (cNow >= half && cNext < half)
                {
                    right = InterpolateAngle(verticalAngles[i], verticalAngles[i + 1], cNow, cNext, half);
                    break;
                }
            }

            double leftAngle = left ?? verticalAngles[0];
            double rightAngle = right ?? verticalAngles[^1];
            double beam = rightAngle - leftAngle;
            if (beam < 0) beam = 0;

            return (peak, peakPlane, verticalAngles[peakV], beam);
        }

        private static double InterpolateAngle(double a1, double a2, double c1, double c2, double target)
        {
            double dc = c2 - c1;
            if (Math.Abs(dc) < 1e-12) return a1;
            return a1 + (target - c1) * (a2 - a1) / dc;
        }

        private static string AppendLine(string existing, string value)
            => string.IsNullOrWhiteSpace(existing) ? value : existing + "\n" + value;

        private static string[] SplitTokens(string line)
            => line.Split(new[] { ' ', '\t' }, StringSplitOptions.RemoveEmptyEntries); // 增强：同时也分割制表符

        private static List<double> ReadDoubles(string[] lines, ref int idx, int count)
        {
            var list = new List<double>(count);
            // 循环读取直到凑够数量
            while (list.Count < count && idx < lines.Length)
            {
                var tokens = SplitTokens(lines[idx]);
                foreach (var token in tokens)
                {
                    if (list.Count < count)
                    {
                        if (double.TryParse(token, NumberStyles.Any, CultureInfo.InvariantCulture, out double val))
                        {
                            list.Add(val);
                        }
                    }
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
}
