import { Component } from '@angular/core';
import { NavController } from 'ionic-angular';

import { OnInit, ElementRef, ViewChild } from '@angular/core';

import { Platform } from 'ionic-angular';

import { loadModules } from 'esri-loader';

@Component({
  selector: 'page-home',
  templateUrl: 'home.html'
})
export class HomePage implements OnInit {
  @ViewChild('map') view1Div: ElementRef;
  mapView: any = null;

  constructor(public navCtrl: NavController, public platform: Platform) { }

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
      if (this.mapView !== null) {
        console.log("Centering map: " + latitude + ", " + longitude);
        this.mapView.center = [longitude, latitude];
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
    ]).then(([Map,
      MapView, SceneView,
      watchUtils]) => {

      console.log("Geo: starting map");

      let map = new Map({
        // basemap: 'hybrid'
        basemap: 'satellite',
        ground: 'world-elevation'
      });

      this.mapView = new SceneView({
        // create the map view at the DOM element in this component
        container: this.view1Div.nativeElement,
        // container: 'view1Div',
        // center: [-12.287, -37.114],
        // zoom: 12,
        map: map,
        constraints: {
          // Disable zoom snapping to get the best synchonization
          snapToZoom: false
        }
      });

    })
      .catch(err => {
        console.log("ArcGIS: " + err);
      });
  }

  ngOnInit() {
    this.getGeo();
  }

}
