@extends('layout')

@section('content')
<center>
    <h1>Rutas disponibles</h1>
    <p>Puedes visualizar todas las rutas disponibles dando clic al siguiente boton dento del mapa</p>
    <img class="icono" src="Icon_ShowARoutes.png" alt="Icono que muestra rutas">
    <br>
    <p>Si no encuentras alguna ruta en el mapa, ten paciencia, pronto estara disponible</p>

    <div class="mapa">
    <iframe src="https://www.google.com/maps/d/u/0/embed?mid=1qJFqlSyVnmzfQsCoxescWJJiDT4iDQ4&ehbc=2E312F" width="100%" height="100%"></iframe>
    </div>

    <h2>Rutas mas populares</h2>
     <a href="/R60"> <button type="button" class="btn btn-outline-primary"> Ruta 60 Pinos-Gobers</button></a>
     <a href="/R61"> <button type="button" class="btn btn-outline-primary"> Ruta 61 Salvador Ortega-Cd. Industrial</button></a>
     <a href="/R15"> <button type="button" class="btn btn-outline-primary"> Ruta 15 Latino Silva</button></a>
    
    
</center>
<br>
@endsection
