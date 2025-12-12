using Photometric.Core.Models.TM33;
using Photometric.Core.Readers.IES;

namespace Photometric.Core.Mapping;

public static class IesToTm33Mapper
{
    public static Tm33Document Map(IesParseResult ies)
    {
        var tm = new Tm33Document
        {
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
                Type = ies.Angles.Type,
                Angles = new Tm33Angles
                {
                    Vertical = ies.Angles.Vertical,
                    Horizontal = ies.Angles.Horizontal
                },
                Candela = new Tm33CandelaMatrix
                {
                    Values = ies.Candela.Values
                }
            }
        };

        return tm;
    }
}
