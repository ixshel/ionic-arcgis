import { Component } from '@angular/core';
import { NavController } from 'ionic-angular';

import { OnInit, ElementRef, ViewChild } from '@angular/core';

import { HttpClient } from '@angular/common/http';

import { Platform } from 'ionic-angular';

import { loadModules } from 'esri-loader';

declare var satellite;

@Component({
  selector: 'page-about',
  templateUrl: 'about.html'
})
export class AboutPage implements OnInit {
  @ViewChild('map') view1Div: ElementRef;
  view: any = null;
  data;

  constructor(public navCtrl: NavController, public platform: Platform, private _http: HttpClient) {
    this._http.get('https://developers.arcgis.com/javascript/latest/sample-code/satellites-3d/live/brightest.txt', { responseType: 'text' })
      .subscribe((res: any) => {
        this.data = res;
      });
  }

  async  getGeo() {

    // Reference: https://ionicframework.com/docs/api/platform/Platform/#ready
    await this.platform.ready();

    let latitude: number = 0, longitude: number = 0;

    const options = {
      enableHighAccuracy: true, // use any allowed location provider
      timeout: 60000            // it can take quite a while for a cold GPS to warm up
    };

    navigator.geolocation.watchPosition(position => {

      latitude = position.coords.latitude;
      longitude = position.coords.longitude;

      // Center map after it has been initialized
      if (this.view !== null) {
        console.log("Centering map: " + latitude + ", " + longitude);
        this.view.center = [longitude, latitude];
      }

    }, error => {

      switch (error.code) {
        case error.PERMISSION_DENIED:
          console.error("User denied the request for Geolocation.");
          break;
        case error.POSITION_UNAVAILABLE:
          console.error("Location information is unavailable.");
          break;
        case error.TIMEOUT:
          console.error("The request to get user location timed out.");
          alert("Unable to start geolocation. Check application settings.");
          break;
      }
    }, options);

    // Load the mapping API modules
    return loadModules([
      "esri/Map",
      "esri/views/MapView",
      "esri/views/SceneView",
      "esri/core/watchUtils",
      "esri/layers/GraphicsLayer",
      "esri/Graphic",
    ]).then(([Map,
      MapView, SceneView, watchUtils, GraphicsLayer, Graphic]) => {


      let map = new Map({
        // basemap: 'hybrid'
        basemap: 'satellite',
        ground: 'world-elevation'
      });

      this.view = new SceneView({
        // create the map view at the DOM element in this component
        container: this.view1Div.nativeElement,
        map: map,
        constraints: {
          // Disable zoom snapping to get the best synchonization
          altitude: {
            max: 12000000000 // meters
          },
          snapToZoom: false
        },
        popup: {
          dockEnabled: true,
          dockOptions: {
            breakpoint: false
          }
        }
      });

      // create layers and tracks
      let satelliteLayer = new GraphicsLayer();
      let satelliteTracks = new GraphicsLayer();

      map.addMany([satelliteLayer, satelliteTracks]);

      // Parse the satellite TLE data
      let lines = this.data.split("\n");
      let count = (lines.length / 3).toFixed(0);

      this.getSatelliteInfo(count, lines, Graphic, satelliteLayer);

      // prevent mouse wheel zoom in or zoom out
      this.view.on('mouse-wheel', (evt) => {
        evt.stopPropagation();
      });

      this.view.popup.on("trigger-action", function(evt) {
        if (evt.action.id === "track" && this.view) {
          var graphic = this.view.popup.selectedFeature;
          var trackFeatures = [];

          for (var i = 0; i < 60 * 24; i++) {

            var loc = null;
            try {
              loc = this.getSatelliteLocation(
                new Date(graphic.attributes.time + i * 1000 * 60),
                graphic.attributes.line1,
                graphic.attributes.line2
              );
            } catch (err) {}

            if (loc !== null) {
              trackFeatures.push([loc.x, loc.y, loc.z]);
            }
          }

          var track = new Graphic({
            geometry: {
              type: "polyline", // autocasts as new Polyline()
              paths: [trackFeatures]
            },
            symbol: {
              type: "line-3d", // autocasts as new LineSymbol3D()
              symbolLayers: [{
                type: "line", // autocasts as new LineSymbol3DLayer()
                material: {
                  color: [192, 192, 192, 0.5]
                },
                size: 3
              }]
            }
          });

          satelliteTracks.add(track);
        }
      });

    }).catch(err => {
      console.log("ArcGIS: " + err);
    });
  }

  getSatelliteLocation(date, line1, line2) {
    var satrec = satellite.twoline2satrec(line1, line2);
    var position_and_velocity = satellite.propagate(
      satrec,
      date.getUTCFullYear(),
      date.getUTCMonth() + 1,
      date.getUTCDate(),
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds()
    );
    var position_eci = position_and_velocity.position;

    var gmst = satellite.gstime_from_date(
      date.getUTCFullYear(),
      date.getUTCMonth() + 1,
      date.getUTCDate(),
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds()
    );

    var position_gd = satellite.eci_to_geodetic(position_eci, gmst);

    var longitude = position_gd.longitude;
    var latitude = position_gd.latitude;
    var height = position_gd.height;
    if (isNaN(longitude) || isNaN(latitude) || isNaN(height)) {
      return null;
    }
    var rad2deg = 180 / Math.PI;
    while (longitude < -Math.PI) {
      longitude += 2 * Math.PI;
    }
    while (longitude > Math.PI) {
      longitude -= 2 * Math.PI;
    }
    return {
      type: "point", // Autocasts as new Point()
      x: rad2deg * longitude,
      y: rad2deg * latitude,
      z: height * 1000
    };
  }

  getSatelliteInfo(count, lines, Graphic, satelliteLayer) {
    for (let i = 0; i < Number(count); i++) {
      var commonName = lines[i * 3 + 0];
      let line1 = lines[i * 3 + 1];
      let line2 = lines[i * 3 + 1];
      let time = Date.now();

      /*************************************************
       * Create attributes for the International
       * designator and Norad identifier. See the
       * doc for details.
       * https://www.space-track.org/documentation#/tle
       *************************************************/

      let designator = line1.substring(9, 16);
      let launchYear = designator.substring(0, 2);
      launchYear = (Number(launchYear) >= 57) ? "19" + launchYear : "20" +
        launchYear;
      let launchNum = Number(designator.substring(2, 5)).toString();
      let noradId = Number(line1.substring(3, 7));
      let satelliteLoc = null;

      try {
        satelliteLoc = this.getSatelliteLocation(new Date(time), line1, line2);
      } catch (err) {
        console.log('nooooooooooooo', err)
      }

      if (satelliteLoc !== null) {
        var template = {
          title: '{name}',
          contente: 'launch number {number} of {year}',
          actions: [{
            title: "Show Satellite Track",
            id: "track",
            className: "esri-icon-globe"
          }]
        }
      }

      let graphic = new Graphic({
        geometry: satelliteLoc,
        symbol: {
          type: "picture-marker", // autocasts as new PictureMarkerSymbol()
          // url: "assets/imgs/satellite.png",
          url: "assets/imgs/Star_Destroyer.png",
          width: 48,
          height: 48
        },
        attributes: {
          name: commonName,
          year: launchYear,
          id: noradId,
          number: launchNum,
          time: time,
          line1: line1,
          line2: line2
        },
        popupTemplate: template
      })

      satelliteLayer.add(graphic);

    }
  }


  ngOnInit() {
    this._http.get('assets/lib/data.txt', { responseType: 'text' })
      .subscribe(data => {
        this.data = data;
        if (this.data) {
          console.log('map v', this.view);
          this.getGeo()
        }
      });

    // this.getGeo()
  }

}

