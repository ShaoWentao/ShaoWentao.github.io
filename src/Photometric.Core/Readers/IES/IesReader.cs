using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq; // 必须引用
using Photometric.Core.Models.Common;
using Photometric.Core.Models.IES;

namespace Photometric.Core.Readers.IES
{
    public static class IesReader
    {
        public static IesParseResult Parse(string iesText, string? fileName = null)
        {
            if (string.IsNullOrWhiteSpace(iesText)) throw new ArgumentException("Empty IES text");

            var lines = iesText.Replace("\r", "").Split('\n', StringSplitOptions.RemoveEmptyEntries);
            int idx = 0;

            // 1. Version
            if (idx >= lines.Length) throw new FormatException("Missing Version");
            var iesHeader = new IesHeader { IesVersion = lines[idx++].Trim() };

            // 2. Keywords
            var common = new PhotometricHeader();
            while (idx < lines.Length)
            {
                var line = lines[idx].Trim();
                if (line.StartsWith("TILT=", StringComparison.OrdinalIgnoreCase)) break;
                // 简化处理 keyword ...
                idx++; 
            }

            // 3. TILT
            if (idx >= lines.Length) throw new FormatException("Missing TILT");
            var tiltLine = lines[idx++];
            // 简单处理 TILT
            var tiltType = tiltLine.Contains("INCLUDE") ? "INCLUDE" : (tiltLine.Contains("NONE") ? "NONE" : "FILE");
            var tilt = new IesTilt { Type = tiltType };
            
            IesTiltReader.TiltIncludeData? tiltInclude = null;
            if (tiltType == "INCLUDE")
            {
                tiltInclude = IesTiltReader.ReadInclude(lines, ref idx);
                tilt = tilt with { Angles = tiltInclude.Angles, Multipliers = tiltInclude.Multipliers };
            }

            // 4. Numeric Header
            if (idx >= lines.Length) throw new FormatException("Missing numeric header");
            var t = SplitTokens(lines[idx]);
            // 防止读取越界，尝试读下一行补全（简化逻辑）
            if (t.Length < 10 && idx + 1 < lines.Length) {
                 t = t.Concat(SplitTokens(lines[++idx])).ToArray();
            }

            // 解析基础参数
            int lampCount = int.Parse(t[0], CultureInfo.InvariantCulture);
            double lumens = double.Parse(t[1], CultureInfo.InvariantCulture);
            double multiplier = double.Parse(t[2], CultureInfo.InvariantCulture);
            int nv = int.Parse(t[3], CultureInfo.InvariantCulture);
            int nh = int.Parse(t[4], CultureInfo.InvariantCulture);
            double inputWatts = t.Length > 12 ? double.Parse(t[12], CultureInfo.InvariantCulture) : 0;

            var photometry = new IesPhotometry
            {
                LampCount = lampCount, LumensPerLamp = lumens, CandelaMultiplier = multiplier,
                VerticalAngleCount = nv, HorizontalAngleCount = nh, InputWatts = inputWatts
            };
            iesHeader = iesHeader with { Tilt = tilt, Photometry = photometry };
            idx++;

            // 5 & 6. Angles
            var vAngles = ReadDoubles(lines, ref idx, nv);
            var hAngles = ReadDoubles(lines, ref idx, nh);
            var angles = new PhotometricAngles { Vertical = vAngles, Horizontal = hAngles };

            // 7. Candela Matrix
            var flatValues = ReadDoubles(lines, ref idx, nh * nv);
            var matrix = new double[nh, nv];
            int k = 0;
            for (int h = 0; h < nh; h++)
                for (int v = 0; v < nv; v++)
                    matrix[h, v] = flatValues[k++] * multiplier;

            // ✅ 修复点 1：转换 List
            var vList = vAngles.ToList(); 
            var hList = hAngles.ToList();

            if (tiltInclude != null)
            {
                // ✅ 修复点 2：传入 List
                var perV = IesTiltReader.BuildVerticalMultipliers(vList, tiltInclude.Angles, tiltInclude.Multipliers);
                IesTiltReader.ApplyToCandela(matrix, perV);
            }

            // ✅ 修复点 3：传入 List
            var (peak, peakH, peakV, beam) = ComputePeakAndBeamAngle(matrix, vList);

            var candela = new CandelaMatrix
            {
                // ✅ 修复点 4：赋值 List
                VerticalAngles = vList,
                HorizontalAngles = hList,
                Values = matrix,
                PeakCandela = peak, PeakPlaneIndex = peakH, PeakVerticalAngle = peakV, BeamAngle = beam
            };

            return new IesParseResult { IesHeader = iesHeader, Angles = angles, Candela = candela };
        }

        // Helpers
        private static string[] SplitTokens(string line) => line.Split(new[] { ' ', '\t' }, StringSplitOptions.RemoveEmptyEntries);
        
        private static List<double> ReadDoubles(string[] lines, ref int idx, int count)
        {
            var list = new List<double>();
            while (list.Count < count && idx < lines.Length)
            {
                foreach (var s in SplitTokens(lines[idx])) 
                    if (double.TryParse(s, NumberStyles.Float, CultureInfo.InvariantCulture, out double d)) list.Add(d);
                idx++;
            }
            return list;
        }

        private static (double, int, double, double) ComputePeakAndBeamAngle(double[,] vals, List<double> vAngles)
        {
             // 简化的占位逻辑，防止编译错误，你需要保留原本完整的逻辑
             return (0, 0, 0, 0); 
        }
    }
}
