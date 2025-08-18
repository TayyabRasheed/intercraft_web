function loadGoogleMapsApi(callback) {
    if (typeof google !== 'undefined' && google.maps) {
        callback();
        return;
    }
    var script = document.createElement('script');
    script.src = "https://maps.googleapis.com/maps/api/js?key=AIzaSyC1mDLrwpqS_2xmZV1QeqJXwtEpjmA7bVg";
    script.async = true;
    script.defer = true;
    script.onload = callback;
    document.head.appendChild(script);
}

// function initMap() {
//     var map = new google.maps.Map(document.getElementById("map"), {
//         zoom: 3,
//         center: { lat: 20, lng: 0 } // world view
//     });
//
//     var geocoder = new google.maps.Geocoder();
//     var locations = [
//         { address: "14015 Hymill Dr, Pflugerville, TX 78660, USA", title: "USA Office - Pflugerville" },
//         { address: "Office UG-8, 9 Grand Xcito, D - Markaz, Gulberg Greens, Islamabad, Pakistan", title: "Pakistan Office - Islamabad" }
//     ];
//
//     locations.forEach(function(loc) {
//         geocoder.geocode({ address: loc.address }, function(results, status) {
//             if (status === "OK") {
//                 var marker = new google.maps.Marker({
//                     position: results[0].geometry.location,
//                     map: map,
//                     title: loc.title
//                 });
//
//                 var infoWindow = new google.maps.InfoWindow({
//                     content: "<b>" + loc.title + "</b><br>" + loc.address
//                 });
//
//                 marker.addListener("click", function() {
//                     infoWindow.open(map, marker);
//                 });
//
//                 // Auto-fit map bounds to include all markers
//                 if (!map.bounds) {
//                     map.bounds = new google.maps.LatLngBounds();
//                 }
//                 map.bounds.extend(results[0].geometry.location);
//                 map.fitBounds(map.bounds);
//             } else {
//                 console.error("Geocode failed for " + loc.address + ": " + status);
//             }
//         });
//     });
// }
function initMap() {
    var mapIds = ["map-desktop", "map-mobile"];

    mapIds.forEach(function(mapId) {
        var mapDiv = document.getElementById(mapId);
        if (!mapDiv) return;

        var map = new google.maps.Map(mapDiv, {
            zoom: 3,
            center: { lat: 20, lng: 0 }
        });

        var geocoder = new google.maps.Geocoder();
        var locations = [
            { address: "14015 Hymill Dr, Pflugerville, TX 78660, USA", title: "USA Office - Pflugerville" },
            { address: "Office UG-8, 9 Grand Xcito, D - Markaz, Gulberg Greens, Islamabad, Pakistan", title: "Pakistan Office - Islamabad" }
        ];

        locations.forEach(function(loc) {
            geocoder.geocode({ address: loc.address }, function(results, status) {
                if (status === "OK") {
                    var marker = new google.maps.Marker({
                        position: results[0].geometry.location,
                        map: map,
                        title: loc.title
                    });

                    var infoWindow = new google.maps.InfoWindow({
                        content: "<b>" + loc.title + "</b><br>" + loc.address
                    });

                    marker.addListener("click", function() {
                        infoWindow.open(map, marker);
                    });

                    if (!map.bounds) {
                        map.bounds = new google.maps.LatLngBounds();
                    }
                    map.bounds.extend(results[0].geometry.location);
                    map.fitBounds(map.bounds);
                }
            });
        });
    });
}


loadGoogleMapsApi(initMap);
