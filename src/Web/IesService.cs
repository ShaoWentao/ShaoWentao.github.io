using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;

namespace Web
{
    public class IesData
    {
        public string Version { get; set; } = "Unknown";
        public string Manufac { get; set; } = "";
        public string Lumcat { get; set; } = "";
        public int LampCount { get; set; } = 1;
        public double LumensPerLamp { get; set; }
        public double InputWatts { get; set; }
        public List<double> VerticalAngles { get; set; } = new();
        public List<double> HorizontalAngles { get; set; } = new();
        public double[,] CandelaValues { get; set; } = new double[0,0];
        public double MaxCandela { get; private set; }

        public void CalculateMax()
        {
            double max = 0;
            foreach (var val in CandelaValues) if (val > max) max = val;
            MaxCandela = max;
        }
    }

    public static class IesParser
    {
        public static IesData Parse(string content)
        {
            var data = new IesData();
            // 统一换行符，去除空行
            var lines = content.Replace("\r", "").Split('\n', StringSplitOptions.RemoveEmptyEntries);
            int i = 0;

            // 1. 读取版本
            if (i < lines.Length) data.Version = lines[i++].Trim();

            // 2. 读取元数据 (MANUFAC, LUMCAT)
            while (i < lines.Length)
            {
                var line = lines[i].Trim();
                if (line.StartsWith("TILT=")) { i++; break; } // TILT 结束头部
                
                if (line.StartsWith("[MANUFAC]")) data.Manufac = line.Replace("[MANUFAC]", "").Trim();
                if (line.StartsWith("[LUMCAT]")) data.Lumcat = line.Replace("[LUMCAT]", "").Trim();
                i++;
            }

            // 3. 跳过 TILT 的具体内容，寻找数据起始行
            // 技巧：数据行通常由 10 或 13 个数字组成
            while (i < lines.Length)
            {
                var parts = Split(lines[i]);
                // 如果这一行第一个是数字，且数量足够，那这就是数据头
                if (parts.Length >= 10 && double.TryParse(parts[0], NumberStyles.Any, CultureInfo.InvariantCulture, out _)) 
                    break;
                i++;
            }

            if (i >= lines.Length) throw new Exception("未找到光度数据块");

            // 4. 读取 13 个核心参数
            // 有些 IES 文件这 13 个参数可能跨两行写，所以我们要读流
            var tokens = ReadTokens(lines, ref i, 13);
            
            data.LampCount = int.Parse(tokens[0]);
            data.LumensPerLamp = double.Parse(tokens[1], CultureInfo.InvariantCulture);
            double multiplier = double.Parse(tokens[2], CultureInfo.InvariantCulture);
            int vCount = int.Parse(tokens[3]);
            int hCount = int.Parse(tokens[4]);
            data.InputWatts = double.Parse(tokens[12], CultureInfo.InvariantCulture);

            // 5. 读取角度
            data.VerticalAngles = ReadDoubles(lines, ref i, vCount);
            data.HorizontalAngles = ReadDoubles(lines, ref i, hCount);

            // 6. 读取光强矩阵 (最关键的一步)
            // IES顺序：先变垂直角，再变水平角
            var rawCandelas = ReadDoubles(lines, ref i, vCount * hCount);
            data.CandelaValues = new double[hCount, vCount];
            
            int idx = 0;
            for (int h = 0; h < hCount; h++)
            {
                for (int v = 0; v < vCount; v++)
                {
                    if (idx < rawCandelas.Count)
                        data.CandelaValues[h, v] = rawCandelas[idx++] * multiplier;
                }
            }
            
            data.CalculateMax();
            return data;
        }

        // 工具函数：把剩下所有的数字都读出来
        private static List<double> ReadDoubles(string[] lines, ref int lineIdx, int count)
        {
            var tokens = ReadTokens(lines, ref lineIdx, count);
            var results = new List<double>();
            foreach (var t in tokens)
            {
                if (double.TryParse(t, NumberStyles.Any, CultureInfo.InvariantCulture, out double val))
                    results.Add(val);
                else
                    results.Add(0); // 容错
            }
            return results;
        }

        private static List<string> ReadTokens(string[] lines, ref int lineIdx, int count)
        {
            var list = new List<string>();
            while (list.Count < count && lineIdx < lines.Length)
            {
                var parts = Split(lines[lineIdx]);
                foreach (var p in parts) list.Add(p);
                lineIdx++;
            }
            return list;
        }

        private static string[] Split(string line) 
            => line.Split(new[] { ' ', '\t', ',' }, StringSplitOptions.RemoveEmptyEntries);
    }
}
