using System.Globalization;
using System.Text;
using System.Xml;
using Photometric.Core.Models.TM33;

namespace Photometric.Core.Writers.TM33;

/// <summary>
/// TM-33 XML writer (Schema-aligned v2).
/// - Writes mandatory file information and measurement units.
/// - Writes photometric data with angle counts, symmetry, angle lists, and candela planes.
/// - Uses invariant culture for numeric output.
/// 
/// Note: This is a schema-aligned structure suitable for most engineering pipelines.
/// For 100% XSD conformance, extend element/attribute names per official TM-33-18 XSD.
/// </summary>
public static class Tm33XmlWriter
{
    public static string WriteToString(Tm33Document doc)
    {
        if (doc is null) throw new ArgumentNullException(nameof(doc));

        var sb = new StringBuilder(128 * 1024);

        var settings = new XmlWriterSettings
        {
            Indent = true,
            OmitXmlDeclaration = false,
            Encoding = new UTF8Encoding(false),
            NewLineHandling = NewLineHandling.Entitize
        };

        using var xw = XmlWriter.Create(sb, settings);

        xw.WriteStartDocument();

        // Root: closer to TM-33 naming
        xw.WriteStartElement("TM33PhotometricData");
        xw.WriteAttributeString("standard", doc.Header.Standard ?? "TM-33-18");

        WriteFileInformation(xw, doc.FileInformation);
        WriteMeasurement(xw, doc.Measurement);

        WriteHeader(xw, doc.Header);
        WriteLuminaire(xw, doc.Luminaire);

        WritePhotometricData(xw, doc.Photometry);

        xw.WriteEndElement(); // TM33PhotometricData
        xw.WriteEndDocument();

        return sb.ToString();
    }

    // ---------------------------------------------------------------------
    // Blocks
    // ---------------------------------------------------------------------

    private static void WriteFileInformation(XmlWriter xw, Tm33FileInformation fi)
    {
        xw.WriteStartElement("FileInformation");

        WriteElem(xw, "Creator", fi.Creator);
        WriteElem(xw, "CreatorVersion", fi.CreatorVersion);
        WriteElem(xw, "Created", fi.Created.ToString("yyyy-MM-ddTHH:mm:ssZ", CultureInfo.InvariantCulture));

        if (!string.IsNullOrWhiteSpace(fi.SourceFile))
            WriteElem(xw, "SourceFile", fi.SourceFile);

        xw.WriteEndElement();
    }

    private static void WriteMeasurement(XmlWriter xw, Tm33Measurement m)
    {
        xw.WriteStartElement("MeasurementUnits");

        WriteElem(xw, "LengthUnit", m.LengthUnit);
        WriteElem(xw, "AngleUnit", m.AngleUnit);
        WriteElem(xw, "IntensityUnit", m.IntensityUnit);
        WriteElem(xw, "FluxUnit", m.FluxUnit);
        WriteElem(xw, "PowerUnit", m.PowerUnit);

        xw.WriteEndElement();
    }

    private static void WriteHeader(XmlWriter xw, Tm33Header h)
    {
        xw.WriteStartElement("TestInformation");

        if (!string.IsNullOrWhiteSpace(h.Laboratory))
            WriteElem(xw, "Laboratory", h.Laboratory);

        if (!string.IsNullOrWhiteSpace(h.ReportNumber))
            WriteElem(xw, "ReportNumber", h.ReportNumber);

        if (h.TestDate.HasValue)
            WriteElem(xw, "TestDate", h.TestDate.Value.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));

        xw.WriteEndElement();
    }

    private static void WriteLuminaire(XmlWriter xw, Tm33Luminaire l)
    {
        xw.WriteStartElement("Luminaire");

        WriteElem(xw, "Manufacturer", l.Manufacturer);
        WriteElem(xw, "Model", l.Model);

        if (!string.IsNullOrWhiteSpace(l.CatalogNumber))
            WriteElem(xw, "CatalogNumber", l.CatalogNumber);

        WriteElem(xw, "InputWatts", F(l.InputWatts));
        WriteElem(xw, "TotalLumens", F(l.TotalLumens));

        xw.WriteEndElement();
    }

    private static void WritePhotometricData(XmlWriter xw, Tm33Photometry p)
    {
        xw.WriteStartElement("PhotometricData");

        // Type, counts, symmetry
        WriteElem(xw, "PhotometricType", p.Type);

        WriteElem(xw, "NumberOfVerticalAngles", p.NumberOfVerticalAngles.ToString(CultureInfo.InvariantCulture));
        WriteElem(xw, "NumberOfHorizontalAngles", p.NumberOfHorizontalAngles.ToString(CultureInfo.InvariantCulture));

        xw.WriteStartElement("Symmetry");
        xw.WriteAttributeString("type", p.Symmetry?.Type ?? "None");
        xw.WriteEndElement();

        // Angles
        xw.WriteStartElement("Angles");

        xw.WriteStartElement("VerticalAngles");
        foreach (var v in p.Angles.Vertical)
            xw.WriteElementString("Angle", F(v));
        xw.WriteEndElement();

        xw.WriteStartElement("HorizontalAngles");
        foreach (var h in p.Angles.Horizontal)
            xw.WriteElementString("Angle", F(h));
        xw.WriteEndElement();

        xw.WriteEndElement(); // Angles

        // Candela Values grouped by horizontal plane
        // Convention: Values[H, V] => H index corresponds to HorizontalAngles[H], V corresponds to VerticalAngles[V]
        xw.WriteStartElement("CandelaValues");

        int nh = p.Candela.HorizontalCount;
        int nv = p.Candela.VerticalCount;

        xw.WriteAttributeString("horizontalCount", nh.ToString(CultureInfo.InvariantCulture));
        xw.WriteAttributeString("verticalCount", nv.ToString(CultureInfo.InvariantCulture));

        for (int hi = 0; hi < nh; hi++)
        {
            var planeAngle = hi < p.Angles.Horizontal.Count ? p.Angles.Horizontal[hi] : (double)hi;

            xw.WriteStartElement("HorizontalPlane");
            xw.WriteAttributeString("angle", F(planeAngle));

            // Per plane, write one Candela element per vertical angle (Gamma)
            for (int vi = 0; vi < nv; vi++)
            {
                xw.WriteElementString("Candela", F(p.Candela.Values[hi, vi]));
            }

            xw.WriteEndElement(); // HorizontalPlane
        }

        xw.WriteEndElement(); // CandelaValues

        xw.WriteEndElement(); // PhotometricData
    }

    // ---------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------

    private static void WriteElem(XmlWriter xw, string name, string value)
    {
        xw.WriteStartElement(name);
        xw.WriteString(value ?? "");
        xw.WriteEndElement();
    }

    // Numeric formatting: stable, invariant, avoids scientific notation for typical photometric ranges.
    private static string F(double v)
        => v.ToString("0.###############", CultureInfo.InvariantCulture);
}
