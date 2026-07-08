// Sri Lanka Location Data
export const sl_locations = {
    "Western": {
        "Colombo": {
            "Colombo 01": "00100", "Colombo 02": "00200", "Colombo 03": "00300", 
            "Colombo 04": "00400", "Colombo 05": "00500", "Colombo 06": "00600",
            "Dehiwala": "10350", "Moratuwa": "10400", "Nugegoda": "10250", 
            "Maharagama": "10280", "Homagama": "10200", "Kottawa": "10230",
            "Malabe": "10115", "Battaramulla": "10120", "Avissawella": "10700",
            "Padukka": "10500", "Piliyandala": "10410"
        },
        "Gampaha": {
            "Gampaha": "11000", "Negombo": "11500", "Kelaniya": "11600", 
            "Kadawatha": "11850", "Wattala": "11300", "Ja-Ela": "11350",
            "Minuwangoda": "11450", "Nittambuwa": "11880", "Veyangoda": "11100",
            "Ragama": "11010", "Kandana": "11320"
        },
        "Kalutara": {
            "Kalutara": "12000", "Panadura": "12500", "Horana": "12400", 
            "Matugama": "12100", "Bandaragama": "12530", "Beruwala": "12070",
            "Aluthgama": "12080"
        }
    },
    "Central": {
        "Kandy": {
            "Kandy": "20000", "Peradeniya": "20400", "Gampola": "20500", 
            "Nawalapitiya": "20650", "Kadugannawa": "20300", "Katugastota": "20800"
        },
        "Matale": {
            "Matale": "21000", "Dambulla": "21100", "Sigiriya": "21120", 
            "Galewela": "21200"
        },
        "Nuwara Eliya": {
            "Nuwara Eliya": "22000", "Hatton": "22080", "Talawakele": "22090", 
            "Nanu Oya": "22150"
        }
    },
    "Southern": {
        "Galle": {
            "Galle": "80000", "Ambalangoda": "80300", "Hikkaduwa": "80240", 
            "Elpitiya": "80400", "Koggala": "80650"
        },
        "Matara": {
            "Matara": "81000", "Weligama": "81700", "Dikwella": "81200", 
            "Akuressa": "81400"
        },
        "Hambantota": {
            "Hambantota": "82000", "Tangalle": "82200", "Ambalantota": "82100", 
            "Tissamaharama": "82600", "Beliatta": "82400"
        }
    },
    "North Western": {
        "Kurunegala": {
            "Kurunegala": "60000", "Kuliyapitiya": "60200", "Narammala": "60100",
            "Polgahawela": "60300", "Mawathagama": "60060"
        },
        "Puttalam": {
            "Puttalam": "61300", "Chilaw": "61000", "Wennappuwa": "61100",
            "Marawila": "61210"
        }
    },
    "Northern": {
        "Jaffna": { "Jaffna": "40000", "Chavakachcheri": "40500", "Point Pedro": "40020", "Nallur": "40000" },
        "Kilinochchi": { "Kilinochchi": "42700" },
        "Mannar": { "Mannar": "41000" },
        "Mullaitivu": { "Mullaitivu": "42000" },
        "Vavuniya": { "Vavuniya": "43000" }
    },
    "Eastern": {
        "Trincomalee": { "Trincomalee": "31000", "Kinniya": "31100", "Mutur": "31200" },
        "Batticaloa": { "Batticaloa": "30000", "Valaichchenai": "30400", "Kattankudy": "30100" },
        "Ampara": { "Ampara": "32000", "Kalmunai": "32300", "Akkaraipattu": "32400" }
    },
    "North Central": {
        "Anuradhapura": { "Anuradhapura": "50000", "Kekirawa": "50100", "Medawachchiya": "50500", "Eppawala": "50250", "Habarana": "50150" },
        "Polonnaruwa": { "Polonnaruwa": "51000", "Hingurakgoda": "51400", "Medirigiriya": "51500" }
    },
    "Uva": {
        "Badulla": { "Badulla": "90000", "Bandarawela": "90100", "Hali-Ela": "90060", "Welimada": "90200", "Mahiyanganaya": "90700", "Ella": "90090" },
        "Moneragala": { "Moneragala": "91000", "Bibile": "91500", "Kataragama": "91400", "Wellawaya": "91200" }
    },
    "Sabaragamuwa": {
        "Ratnapura": { "Ratnapura": "70000", "Balangoda": "70100", "Pelmadulla": "70070", "Embilipitiya": "70200" },
        "Kegalle": { "Kegalle": "71000", "Mawanella": "71500", "Ruwanwella": "71300", "Warakapola": "71600" }
    }
};

export function setupLocationDropdowns(provId, distId, townId, zipId) {
    const provSelect = document.getElementById(provId);
    const distSelect = document.getElementById(distId);
    const townSelect = document.getElementById(townId);
    const zipInput = document.getElementById(zipId);

    if (!provSelect || !distSelect || !townSelect || !zipInput) return;

    // Populate Provinces
    provSelect.innerHTML = '<option value="">Select Province</option>';
    Object.keys(sl_locations).sort().forEach(prov => {
        const opt = document.createElement('option');
        opt.value = prov;
        opt.textContent = prov;
        provSelect.appendChild(opt);
    });

    provSelect.addEventListener('change', () => {
        distSelect.innerHTML = '<option value="">Select District</option>';
        townSelect.innerHTML = '<option value="">Select Town</option>';
        zipInput.value = '';
        distSelect.disabled = true;
        townSelect.disabled = true;

        const prov = provSelect.value;
        if (prov && sl_locations[prov]) {
            distSelect.disabled = false;
            Object.keys(sl_locations[prov]).sort().forEach(dist => {
                const opt = document.createElement('option');
                opt.value = dist;
                opt.textContent = dist;
                distSelect.appendChild(opt);
            });
        }
    });

    distSelect.addEventListener('change', () => {
        townSelect.innerHTML = '<option value="">Select Town</option>';
        zipInput.value = '';
        townSelect.disabled = true;

        const prov = provSelect.value;
        const dist = distSelect.value;
        if (prov && dist && sl_locations[prov][dist]) {
            townSelect.disabled = false;
            Object.keys(sl_locations[prov][dist]).sort().forEach(town => {
                const opt = document.createElement('option');
                opt.value = town;
                opt.textContent = town;
                townSelect.appendChild(opt);
            });
        }
    });

    townSelect.addEventListener('change', () => {
        const prov = provSelect.value;
        const dist = distSelect.value;
        const town = townSelect.value;
        zipInput.value = '';

        if (prov && dist && town && sl_locations[prov][dist][town]) {
            zipInput.value = sl_locations[prov][dist][town];
        }
    });
}
