/*--------------------------------------------------------------------
GGR472 LAB 4: Incorporating GIS Analysis into web maps using Turf.js 
--------------------------------------------------------------------*/


/*--------------------------------------------------------------------
INITIALIZE MAP
--------------------------------------------------------------------*/
//Define access token
mapboxgl.accessToken = 'pk.eyJ1Ijoic3RlcGhuZWUiLCJhIjoiY2xkdnp0dmExMDJreDNwcXd6ajY1cHp1cSJ9.JkrzcmpJLmS8dzQwqlCcRg';

//Initialize map and edit to your preference
const map = new mapboxgl.Map({
    container: 'map', //container id in HTML
    style: 'mapbox://styles/mapbox/streets-v12',  
    center: [-79.34702, 43.65107],    // Long, lat
    zoom: 8,
    maxBounds: [
        [-90, 10],     // South, West extent of map
        [-60, 60]     // North, East extent of map
    ],
});



/*--------------------------------------------------------------------
FETCH DATA 
--------------------------------------------------------------------*/

// Empty variable for collisions
let collision;

// Fetch GeoJSON from github URL, convert response to JSON, and store response as variable 
fetch('https://raw.githubusercontent.com/neesteph/Lab-4/main/ggr472-lab4/data/pedcyc_collision_06-21.geojson')
    .then(response => response.json())      // Store response as JSON format
    .then(response => {
        console.log(response);      // Check response in console
        collision = response;       // Store GeoJSON as "collision" variable
    });


// Empty variable for neighbourhoods
let neighbourhood;

// Fetch GeoJSON from github URL, convert response to JSON, and store response as variable 
fetch('https://raw.githubusercontent.com/emily-sakaguchi/Final-project-GGR472-/main/Final_clean_neighbourhoods140.geojson')
.then(response => response.json())      // Store response as JSON format
.then(response => {
    console.log(response);      // Check response in console
    neighbourhood = response;       // Store GeoJSON as "collision" variable
});


/*--------------------------------------------------------------------
LOAD DATA INTO MAP
--------------------------------------------------------------------*/

map.on('load', () => {

    // Add collision data from GeoJSON file as a data source 
    map.addSource('pedcyc-collision', {
        type: 'geojson',
        data: collision     // Same file as the GeoJSON fetched from github URL 
    });

    // Add collision points layer to map
    map.addLayer({
        'id': 'collisions-points',
        'type': 'circle',
        'source': 'pedcyc-collision',
        'paint': {
            'circle-radius': 5,
            'circle-color': 'blue'
        }
    });

    // Add collision injury layer to map
    map.addLayer({
        'id': 'collis-injury',
        'type': 'circle',
        'source': 'pedcyc-collision',
        'paint': {
            'circle-radius': 5,
            'circle-color': [
                // Colour of points based on injury type
                'match',
                ['get', 'INJURY'],
                'None',
                '#8af280',
                'Minor',
                '#faf443',
                'Minimal',
                '#ffc619',
                'Major',
                '#fa5e37',
                'Fatal',
                '#f00000',
                'blue'      // Default colour is blue
            ]
        }
    });


    /*--------------------------------------------------------------------
    BOUNDING BOX
    --------------------------------------------------------------------*/

    // ENVELOPE function takes all point features in the "collision" GeoJSON and forms a rectangle polygon around it 
    // This bbox variable will be the "bounding box"
    let bbox = turf.envelope(collision);

    // This variable will hold the bounding box feature
    let bboxgeojson = {
        'type': 'FeatureCollection',    // Variable stored in "FeatureCollection" GeoJSON format
        'features': [bbox]
    };

    // Add bounding box as data source 
    map.addSource('envelopeGeoJSON', {
        'type': 'geojson',
        'data': bboxgeojson
    });

    // Add bounding box as a layer to the map
    map.addLayer({
        'id': 'collisionEnv',
        'type': 'fill',
        'source': 'envelopeGeoJSON',
        'paint': {
            'fill-color': "red",
            'fill-opacity': 0.5,
            'fill-outline-color': "black"
        }
    });


    /*--------------------------------------------------------------------
    HEXGRID
    --------------------------------------------------------------------*/

    // Increases size of bounding box by 10% so that it will be fully covered by hex grid
    let bboxscaled = turf.transformScale(bbox, 1.10);

    // Array variable that stores the coordinates of the bounding box
    // This variable will be used as the borders/extent for the hex grid
    let bboxcoords = [bboxscaled.geometry.coordinates[0][0][0],     // minX
                    bboxscaled.geometry.coordinates[0][0][1],       // minY
                    bboxscaled.geometry.coordinates[0][2][0],       // maxX
                    bboxscaled.geometry.coordinates[0][2][1]];      // maxY
    // This variable determines the length of the side of the hexagons, based on unit defined in "options" variable 
    var cellSide = 0.5;
    var options = {units: 'kilometers'};

    // HEXGRID function creates hexagonal grid based on "bboxcoords" extent and size determined by "cellSide" and "options"
    let hexgrid = turf.hexGrid(bboxcoords, cellSide, options);

    // Adds hex grid as data source
    map.addSource('hexgridbbox', {
        type: 'geojson',
        data: hexgrid
    });

    // Adds hex grid as layer to map
    map.addLayer({
        'id': 'hexaGrid',
        'type': 'fill',
        'source': 'hexgridbbox',
        'paint': {
            'fill-color': "grey",
            'fill-opacity': 0.5,
            'fill-outline-color': "black"
        }
    });


    /*--------------------------------------------------------------------
    COLLECT ON HEXGRID
    --------------------------------------------------------------------*/

    // COLLECT function merges hexgrid layer with collision points layer
    // Groups all of the points contained within each hexagon by unique ID
    let collishex = turf.collect(hexgrid, collision, '_id', 'values');

    // Maximum number of collisions in a hexagon
    let maxcollis = 0;

    /* 
        forEach loops through every hexagon
        COUNT field is created, in which the value is the amount of unique ID within each hexagon
        Boolean updates the maxcollis variable so that if the COUNT value is bigger than the previous hexagon, 
        then the maxcollis value will update to that current COUNT value 
    */
    collishex.features.forEach((feature) => {
        feature.properties.COUNT = feature.properties.values.length
        if (feature.properties.COUNT > maxcollis) {
            maxcollis = feature.properties.COUNT
        }
    });

    console.log(maxcollis);

    // Adds merged collision and hex grid layer as data source
    map.addSource('collis-hex', {
        type: 'geojson',
        data: hexgrid
    });

    // Adds merged collision and hex grid layer to map
    map.addLayer({
        'id': 'collis-hex-fill',
        'type': 'fill',
        'source': 'collis-hex',
        'paint': {
            'fill-color': [
                // Each hexagon's colour is based on where its COUNT value falls within the intervals
                'step',
                ['get', 'COUNT'],
                '#a7dcfa',
                10, '#5ebdf2',
                20, '#139fed',
                30, '#0f6fd6',
                40, '#0957ab',
                50, '#01317d'
            ],
            'fill-opacity': 0.5,
            'fill-outline-color': 'white'
        }
    });


    /*--------------------------------------------------------------------
    COLLECT ON NEIGHBOURHOOD
    --------------------------------------------------------------------*/


    // Add neighbourhood data from GeoJSON file as a data source 
    map.addSource('neighbourhood-layer', {
        type: 'geojson',
        data: neighbourhood    // Same file as the GeoJSON fetched from github URL 
    });

    // COLLECT function merges neighbourhood layer with collision points layer
    // Groups all of the points contained within each neighbourhood by unique ID
    let neighpoints = turf.collect(neighbourhood, collision, '_id', 'values');

    // Maximum number of collisions in a neighbourhood
    let maxcollisneigh = 0;

    /* 
        forEach loops through every neighbourhood
        COUNT field is created, in which the value is the amount of unique ID within each neighbourhood
        Boolean updates the maxcollisneigh variable so that if the COUNT value is bigger than the previous neighbourhood, 
        then the maxcollisneigh value will update to that current COUNT value 
    */
    neighpoints.features.forEach((feature) => {
        feature.properties.COUNT = feature.properties.values.length
        if (feature.properties.COUNT > maxcollis) {
            maxcollisneigh = feature.properties.COUNT
        }
    });

    console.log(maxcollisneigh);

    // Adds merged neighbourhood collision points layer as data source
    map.addSource('neigh-points', {
        type: 'geojson',
        data: neighbourhood
    });


    // Adds neighbourhood collision points layer to map
    map.addLayer({
        'id': 'collis-by-neigh',
        'type': 'fill',
        'source': 'neigh-points',
        'paint': {
            'fill-color': [
                // Each neighbourhood colour is based on where its COUNT value falls within the intervals
                'step',
                ['get', 'COUNT'],
                '#a7dcfa',
                10, '#5ebdf2',
                20, '#139fed',
                30, '#0f6fd6',
                40, '#0957ab',
                50, '#01317d'
            ],
            'fill-opacity': 0.5,
            'fill-outline-color': 'black'
        }
    });


    /*--------------------------------------------------------------------
    TURN OFF LAYER DEFAULT
    --------------------------------------------------------------------*/


    // Turns off bounding box layer by default
    map.setLayoutProperty(
        'collisionEnv',
        'visibility',
        'none'
    );

    // Turns off hex grid layer by default
    map.setLayoutProperty(
        'hexaGrid',
        'visibility',
        'none'
    );

    // Turns off coloured hex grid layer by default
    map.setLayoutProperty(
        'collis-hex-fill',
        'visibility',
        'none'
    );

    // Turns off injury type layer by default
    map.setLayoutProperty(
        'collis-injury',
        'visibility',
        'none'
    );

    // Turns off neighbourhood layer by default
    map.setLayoutProperty(
        'collis-by-neigh',
        'visibility',
        'none'
    );

});



/*--------------------------------------------------------------------
POP-UP CONTAINERS
--------------------------------------------------------------------*/

// Creates pop-up for each hexagon when clicked on, which shows the collision count 
map.on('click', 'collis-hex-fill', (e) => {
    new mapboxgl.Popup()
        .setLngLat(e.lngLat)
        .setHTML("<b>Collision Count: </b>" + e.features[0].properties.COUNT)
        .addTo(map);
});

// Creates pop-up for each neighbourhood when clicked on, which shows the neighbourhood name and collision count 
map.on('click', 'collis-by-neigh', (e) => {
    new mapboxgl.Popup()
        .setLngLat(e.lngLat)
        .setHTML("<b>Neighbourhood: </b>" + e.features[0].properties.Neighbourhood + "<br>" +
                "<b>Collision Count: </b>" + e.features[0].properties.COUNT)
        .addTo(map);
});



/*--------------------------------------------------------------------
ADDING MAPBOX CONTROLS AS ELEMENTS ON MAP
--------------------------------------------------------------------*/

// Add zoom and rotation controls to map
map.addControl(new mapboxgl.NavigationControl());

// Add fullscreen option to map
map.addControl(new mapboxgl.FullscreenControl());



/*--------------------------------------------------------------------
ADD INTERACTIVITY BASED ON HTML EVENT
--------------------------------------------------------------------*/

//Create geocoder variable
const geocoder = new MapboxGeocoder({
    accessToken: mapboxgl.accessToken,
    mapboxgl: mapboxgl,
    countries: "ca"
});

//Use geocoder div to position geocoder on page
document.getElementById('geocoder').appendChild(geocoder.onAdd(map));


// This event listener allows the map to go back to its initial extent when the button is clicked on
document.getElementById('returnbutton').addEventListener('click', () => {
    map.flyTo({
        center: [-79.34702, 43.65107],
        zoom: 8,
        essential: true
    });
});


// Mouse changes from cursor to pointer when hovering over a hexagon
map.on('mouseenter', 'collis-hex-fill', () => {
    map.getCanvas().style.cursor = 'pointer';   
});

// Mouse changes from pointer to cursor when not hovering over a hexagon
map.on('mouseleave', 'collis-hex-fill', () => {
    map.getCanvas().style.cursor = '';
});


// Mouse changes from cursor to pointer when hovering over a neighbourhood
map.on('mouseenter', 'collis-by-neigh', () => {
    map.getCanvas().style.cursor = 'pointer';   
});

// Mouse changes from pointer to cursor when not hovering over a neighbourhood
map.on('mouseleave', 'collis-by-neigh', () => {
    map.getCanvas().style.cursor = '';
});


/*--------------------------------------------------------------------
CREATE LEGEND IN JAVASCRIPT
--------------------------------------------------------------------*/

// Change display of legend based on check box
let legendCheck = document.getElementById('legendCheck');

// Boolean statement for display of legend based on check box
legendCheck.addEventListener('click', () => {
    if (legendCheck.checked) {
        legendCheck.checked = true;
        legend.style.display = 'block';
    }
    else {
        legend.style.display = "none";
        legendCheck.checked = false;
    }
});


// Bounding box layer display (check box)
document.getElementById('bboxCheck').addEventListener('change', (e) => {
    map.setLayoutProperty(
        'collisionEnv',
        'visibility',
        e.target.checked ? 'visible' : 'none'
    );
});

// Hex grid layer display (check box)
document.getElementById('hexCheck').addEventListener('change', (e) => {
    map.setLayoutProperty(
        'hexaGrid',
        'visibility',
        e.target.checked ? 'visible' : 'none'
    );

    map.setLayoutProperty(
        'collis-hex-fill',
        'visibility',
        e.target.checked ? 'visible' : 'none'
    );
});

// Collision injury type layer display (check box)
document.getElementById('injuryCheck').addEventListener('change', (e) => {
    map.setLayoutProperty(
        'collis-injury',
        'visibility',
        e.target.checked ? 'visible' : 'none'
    );
});

// Neighbourhood layer display (check box)
document.getElementById('neighCheck').addEventListener('change', (e) => {
    map.setLayoutProperty(
        'collis-by-neigh',
        'visibility',
        e.target.checked ? 'visible' : 'none'
    );
});




