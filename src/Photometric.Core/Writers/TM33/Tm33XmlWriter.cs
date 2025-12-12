using System.Globalization;
using System.Text;
using System.Xml;
using Photometric.Core.Models.TM33;

namespace Photometric.Core.Writers.TM33;

/// <summary>
/// TM-33 XML writer (engineering v1).
/// Outputs a consistent XML structure suitable for downstream use.
/// You can later extend elements/attributes to match full TM-33 schema exactly.
/// </summary>
public static class Tm33XmlWriter
{
    public static string WriteToString(Tm33Document doc)
    {
        var sb = new StringBuilder(64 * 1024);

        var settings = new XmlWriterSettings
        {
            Indent = true,
            OmitXmlDeclaration = false,
            Encoding = new UTF8Encoding(false)
        };

        using var xw = XmlWriter.Create(sb, settings);

        xw.WriteStartDocument();

        xw.WriteStartElement("TM33");
        xw.WriteAttributeString("standard", doc.Header.Standard);

        // Header
        xw.WriteStartElement("Header");
        WriteElem(xw, "Laboratory", doc.Header.Laboratory);
        WriteElem(xw, "ReportNumber", doc.Header.ReportNumber);
        if (doc.Header.TestDate.HasValue)
            WriteElem(xw, "TestDate", doc.Header.TestDate.Value.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));
        xw.WriteEndElement();

        // Luminaire
        xw.WriteStartElement("Luminaire");
        WriteElem(xw, "Manufacturer", doc.Luminaire.Manufacturer);
        WriteElem(xw, "Model", doc.Luminaire.Model);
        WriteElem(xw, "CatalogNumber", doc.Luminaire.CatalogNumber);
        WriteElem(xw, "InputWatts", doc.Luminaire.InputWatts.ToString(CultureInfo.InvariantCulture));
        WriteElem(xw, "TotalLumens", doc.Luminaire.TotalLumens.ToString(CultureInfo.InvariantCulture));
        xw.WriteEndElement();

        // Photometry
        xw.WriteStartElement("Photometry");
        WriteElem(xw, "Type", doc.Photometry.Type);

        // Angles
        xw.WriteStartElement("Angles");
        xw.WriteStartElement("Vertical");
        foreach (var v in doc.Photometry.Angles.Vertical)
            xw.WriteElementString("A", v.ToString(CultureInfo.InvariantCulture));
        xw.WriteEndElement();

        xw.WriteStartElement("Horizontal");
        foreach (var h in doc.Photometry.Angles.Horizontal)
            xw.WriteElementString("A", h.ToString(CultureInfo.InvariantCulture));
        xw.WriteEndElement();
        xw.WriteEndElement(); // Angles

        // Candela matrix [H,V]
        xw.WriteStartElement("Candela");
        xw.WriteAttributeString("rows", doc.Photometry.Candela.HorizontalCount.ToString(CultureInfo.InvariantCulture));
        xw.WriteAttributeString("cols", doc.Photometry.Candela.VerticalCount.ToString(CultureInfo.InvariantCulture));

        for (int hi = 0; hi < doc.Photometry.Candela.HorizontalCount; hi++)
        {
            xw.WriteStartElement("Row");
            xw.WriteAttributeString("h", hi.ToString(CultureInfo.InvariantCulture));
            for (int vi = 0; vi < doc.Photometry.Candela.VerticalCount; vi++)
            {
                xw.WriteElementString("C", doc.Photometry.Candela.Values[hi, vi].ToString(CultureInfo.InvariantCulture));
            }
            xw.WriteEndElement();
        }

        xw.WriteEndElement(); // Candela
        xw.WriteEndElement(); // Photometry

        xw.WriteEndElement(); // TM33
        xw.WriteEndDocument();

        return sb.ToString();
    }

    private static void WriteElem(XmlWriter xw, string name, string value)
    {
        xw.WriteStartElement(name);
        xw.WriteString(value ?? "");
        xw.WriteEndElement();
    }
}
