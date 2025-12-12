using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq; // 确保引用 Linq

namespace Photometric.Core.Readers.IES
{
    public static class IesTiltReader
    {
        // 定义一个内部类来传递解析结果
        public class TiltIncludeData
        {
            public List<double> Angles { get; set; } = new();
            public List<double> Multipliers { get; set; } = new();
        }

        /// <summary>
        /// 当 TILT=INCLUDE 时，读取随后的参数（灯泡数, 角度数, 角度列表, 系数列表）
        /// </summary>
        public static TiltIncludeData ReadInclude(string[] lines, ref int idx)
        {
            // 1. 读取 LampCount (通常是 1)
            // 有些 IES 文件这一行可能包含多个数字，我们只取第一个有效数字
            // 格式示例: 1
            if (idx >= lines.Length) throw new FormatException("Unexpected end of file reading TILT lamp count.");
            
            // 跳过可能的空行
            while (string.IsNullOrWhiteSpace(lines[idx])) 
            {
                idx++;
                if (idx >= lines.Length) throw new FormatException("Unexpected end of file reading TILT lamp count.");
            }

            var tokens = SplitTokens(lines[idx]);
            if (tokens.Length == 0) throw new FormatException("Invalid TILT lamp count line.");
            
            // 我们其实不太关心这里的 lampCount 具体是多少，只要格式对就行，通常是 1
            // int lampCount = int.Parse(tokens[0]); 
            idx++;

            // 2. 读取 角度数量 (N)
            if (idx >= lines.Length) throw new FormatException("Unexpected end of file reading TILT angles count.");
            tokens = SplitTokens(lines[idx]);
            if (tokens.Length == 0) throw new FormatException("Invalid TILT angles count line.");
            
            int count = int.Parse(tokens[0]);
            idx++;

            // 3. 读取 N 个角度
            var angles = ReadDoubles(lines, ref idx, count);

            // 4. 读取 N 个乘数因子 (Multipliers)
            var multipliers = ReadDoubles(lines, ref idx, count);

            return new TiltIncludeData
            {
                Angles = angles,
                Multipliers = multipliers
            };
        }

        /// <summary>
        /// 根据垂直角度列表，计算出对应的 TILT 修正系数列表
        /// </summary>
        public static List<double> BuildVerticalMultipliers(
            List<double> verticalAngles,
            List<double> tiltAngles,
            List<double> tiltMultipliers)
        {
            var result = new List<double>(verticalAngles.Count);

            foreach (var vAngle in verticalAngles)
            {
                // 插值计算当前垂直角对应的修正系数
                double mult = Interpolate(tiltAngles, tiltMultipliers, vAngle);
                result.Add(mult);
            }

            return result;
        }

        /// <summary>
        /// 将修正系数应用到 Candela 矩阵上
        /// </summary>
        public static void ApplyToCandela(double[,] matrix, List<double> verticalMultipliers)
        {
            int nh = matrix.GetLength(0);
            int nv = matrix.GetLength(1);

            if (verticalMultipliers.Count != nv)
                throw new ArgumentException("Vertical multipliers count mismatch.");

            for (int h = 0; h < nh; h++)
            {
                for (int v = 0; v < nv; v++)
                {
                    matrix[h, v] *= verticalMultipliers[v];
                }
            }
        }

        // ================== Helpers ==================

        private static string[] SplitTokens(string line)
            => line.Split(new[] { ' ', '\t' }, StringSplitOptions.RemoveEmptyEntries);

        private static List<double> ReadDoubles(string[] lines, ref int idx, int count)
        {
            var list = new List<double>(count);
            while (list.Count < count && idx < lines.Length)
            {
                var tokens = SplitTokens(lines[idx]);
                foreach (var token in tokens)
                {
                    if (list.Count < count && double.TryParse(token, NumberStyles.Any, CultureInfo.InvariantCulture, out var val))
                    {
                        list.Add(val);
                    }
                }
                idx++;
            }
            return list;
        }

        private static double Interpolate(List<double> xValues, List<double> yValues, double xTarget)
        {
            // 简单的线性插值
            // 假设 xValues 是有序的
            if (xValues.Count == 0) return 1.0;
            if (xValues.Count == 1) return yValues[0];

            // 边界处理
            if (xTarget <= xValues[0]) return yValues[0];
            if (xTarget >= xValues[^1]) return yValues[^1];

            // 查找区间
            for (int i = 0; i < xValues.Count - 1; i++)
            {
                if (xTarget >= xValues[i] && xTarget <= xValues[i + 1])
                {
                    double x1 = xValues[i];
                    double x2 = xValues[i + 1];
                    double y1 = yValues[i];
                    double y2 = yValues[i + 1];

                    double t = (xTarget - x1) / (x2 - x1);
                    return y1 + t * (y2 - y1);
                }
            }

            return 1.0; // Should not reach here
        }
    }
}
