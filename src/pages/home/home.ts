import { Component } from '@angular/core';
import { NavController } from 'ionic-angular';
// import { File } from '@ionic-native/file';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'page-home',
  templateUrl: 'home.html'
})
export class HomePage {
  destroyersData;

  constructor(public navCtrl: NavController, 
    // private file: File, 
    private _http: HttpClient) { }

  getTextFile() {
    this._http.get('assets/lib/data.txt', { responseType: 'text' })
      .subscribe(data => {
        this.destroyersData = data;
      });
  };
}