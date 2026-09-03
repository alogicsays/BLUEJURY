# MVP Remote-Sensing Method

BLUEJURY retrieves bounded real Copernicus Level-3 chlorophyll and OSTIA SST analysis for the departure AOI. Provider fill values are decoded and excluded. Chlorophyll is ranked relative to valid cells in that AOI; this is not a universal fish-abundance threshold. Candidate suitability is 80% AOI chlorophyll percentile plus 20% availability of local SST context. The strongest cells separated by at least 10 km become up to three 2.5 km-radius high-potential candidate areas.

SST, uncertainty, flags, source times, and evidence references are retained. A fisher-selected point uses the same nearest real-grid evidence and jury path; it is never presumed suitable. Routes are eight-segment geodesic approximations from start to centroid and are labelled decision-support routes, not navigation.

This simple MVP method is deterministic and inspectable. It does not claim official INCOIS PFZ status, fish presence, species suitability, or guaranteed catch. Later work must validate biological interpretation, coast masks, interpolation, candidate morphology, and separation/radius parameters with domain experts.
