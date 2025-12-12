using Photometric.Core.Models.Common;
using Photometric.Core.Models.TM33;
using Photometric.Core.Readers.IES;

namespace Photometric.Core.Mapping;

/// <summary>
/// Maps parsed IES data to a TM-33-18 compliant document (core + mandatory fields).
/// </summary>
public static class IesToTm33Mapper
{
    public static Tm33Document Map(IesParseResult ies, string? sourceFileName = null)
    {
        if (ies == null)
            throw new ArgumentNullException(nameof(ies));

        var angles = ies.Angles;
        var candela = ies.Candela;

        int nv = angles.Vertical.Count;
        int nh = angles.Horizontal.Count;

        // ------------------------------------------------------------------
        // 1) Derive symmetry (simple, standard-compliant heuristic)
        // ------------------------------------------------------------------
        // TM-33 allows more detailed symmetry definitions, but this mapping
        // is accepted by most tools and consistent with IES practice.
        var symmetryType = nh switch
        {
            1 => "Axial",        // rotationally symmetric
            2 => "Bilateral",   // typically 0–180
            _ => "None"
        };

        // ------------------------------------------------------------------
        // 2) Measurement units (derive from IES UnitsType)
        // ------------------------------------------------------------------
        // IES: 1 = feet, 2 = meters
        var measurement = new Tm33Measurement
        {
            LengthUnit = ies.IesHeader.Photometry.UnitsType == 1 ? "foot" : "meter",
            AngleUnit = "degree",
            IntensityUnit = "candela",
            FluxUnit = "lumen",
            PowerUnit = "watt"
        };

        // ------------------------------------------------------------------
        // 3) File information
        // ------------------------------------------------------------------
        var fileInfo = new Tm33FileInformation
        {
            Creator = "Photometric Tools",
            CreatorVersion = "1.0",
            Created = DateTime.UtcNow,
            SourceFile = sourceFileName ?? string.Empty
        };

        // ------------------------------------------------------------------
        // 4) Build TM-33 document
        // ------------------------------------------------------------------
        var tm33 = new Tm33Document
        {
            FileInformation = fileInfo,
            Measurement = measurement,

            Header = new Tm33Header
            {
                Standard = "TM-33-18",
                Laboratory = ies.CommonHeader.TestLaboratory,
                ReportNumber = ies.CommonHeader.TestReport,
                TestDate = null
            },

            Luminaire = new Tm33Luminaire
            {
                Manufacturer = ies.CommonHeader.Manufacturer,
                Model = ies.CommonHeader.Luminaire,
                CatalogNumber = ies.CommonHeader.CatalogNumber,
                InputWatts = ies.CommonHeader.InputWatts,
                TotalLumens = ies.CommonHeader.TotalLumens
            },

            Photometry = new Tm33Photometry
            {
                Type = angles.Type,

                NumberOfVerticalAngles = nv,
                NumberOfHorizontalAngles = nh,

                Symmetry = new Tm33Symmetry
                {
                    Type = symmetryType
                },

                Angles = new Tm33Angles
                {
                    Vertical = angles.Vertical,
                    Horizontal = angles.Horizontal
                },

                Candela = new Tm33CandelaMatrix
                {
                    Values = candela.Values
                }
            }
        };

        return tm33;
    }
}
