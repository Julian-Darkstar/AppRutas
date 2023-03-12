<?php

use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
|
| Here is where you can register web routes for your application. These
| routes are loaded by the RouteServiceProvider within a group which
| contains the "web" middleware group. Now create something great!
|
*/

Route::get('/', function () {
    return view('Rutas.index');
});

Route::get('/contacto', function () {
    return view('Rutas.devContact');
});

Route::get('/R60', function () {
    return view('Rutas.Ruta60Pinos');
});

Route::get('/R61', function () {
    return view('Rutas.Ruta61Industrial');
});

Route::get('/about', function () {
    return view ('Rutas.about');
});

Route::get('/no-disponible', function () {
    return view ('Rutas.proximamente');
});