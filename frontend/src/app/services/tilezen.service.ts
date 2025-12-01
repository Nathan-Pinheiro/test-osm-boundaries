import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class TilezenService {
  /**
   * Service that provide a 256x256 grid of elevations at given tile coordinates
   * Use the public elevation data made availaible by the Linux Foundation Project Mapzen (cf. https://www.mapzen.com/)
   * @author Louis BOSSY
   */

  constructor(private http: HttpClient) {}

  getTile(z: number, x: number, y: number): Promise<Array<number>> {
    /**
     * Get a 256x256 grid of elevations for the given tile coordinates
     * @param z Zoom level (comprised between 1 (whole world) and 15)
     * @param x Tile coordinate x (at zoom level z, comprised between 1 and 2^(z-1)-1)
     * @param y Tile coordinate y (at zoom level z, comprised between 1 and 2^(z-1)-1)
     * @returns A Promise that resolves to a 256x256 array of elevations in meters
     */
    if (x > 2 ** (z) - 1 || x < 0 || y > 2 ** (z) - 1 || y < 0)
      throw new Error(`Tile coordinates out of bounds : ${z} ${x} ${y}`);

    return new Promise((resolve, reject) => {
      var tile: Array<number> = new Array<number>(256 * 256);

      var image = new Image();
      image.crossOrigin = 'anonymous'; // Allow reading pixel data from cross-origin image
      
      image.onload = function() {
        try {
          var canvas = document.createElement('canvas');
          canvas.width = image.width;
          canvas.height = image.height;

          var context = canvas.getContext('2d');
          if (context === null)
            throw new Error('Processing failure, please try again');
          context.drawImage(image, 0, 0);

          var imageData = context.getImageData(0, 0, canvas.width, canvas.height);

          for (let i  = 0; i < 256; i++) {
            for (let j = 0; j < 256; j++) {
              tile[i * 256 + j] = (imageData.data[(i * 256 + j) * 4] * 256 + 
                                    imageData.data[(i * 256 + j) * 4 + 1] +
                                    imageData.data[(i * 256 + j) * 4 + 2] / 256) - 32768;
            }
          }
          resolve(tile);
        } catch (error) {
          reject(error);
        }
      };

      image.onerror = function() {
        reject(new Error(`Failed to load elevation tile: ${z}/${x}/${y}`));
      };

      image.src = this.getApiUrl(z, x, y);
    });
  }

  private getApiUrl(z: number, x: number, y: number): string {
    if (x > 2 ** (z) - 1 || x < 0 || y > 2 ** (z) - 1 || y < 0) {
      throw new Error('Tile coordinates out of bounds');
    }
    return `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;
  }
}