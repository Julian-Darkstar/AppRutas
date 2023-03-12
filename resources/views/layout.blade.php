<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AppRutas</title>
    <!-- CSS only -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.2.3/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-rbsA2VBKQhggwzxH7pPCaAqO46MgnOM80zW1RWuH61DGLwZJEdK2Kadq2F9CUG65" crossorigin="anonymous">
    <script src="https://cdn.jsdelivr.net/npm/@popperjs/core@2.11.6/dist/umd/popper.min.js" integrity="sha384-oBqDVmMz9ATKxIep9tiCxS/Z9fNfEXiDAYTujMAeBAsjFuCZSmKbSSUnQlmh/jp3" crossorigin="anonymous"></script>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.2.3/dist/js/bootstrap.min.js" integrity="sha384-cuYeSxntonz0PPNlHhBs68uyIAVpIIOZZ5JqeqvYYIcEL727kskC66kF92t6Xl2V" crossorigin="anonymous"></script>
    <link rel="stylesheet" href="css/app.css"> <!-- Se encuentra en Public/css/app.css -->
    <style>
      
    </style>

</head>
<body>

    <nav class="navbar navbar-expand-lg bg-light">
      <div class="container-fluid">   
        
        <a class="navbar-brand" href="/">
        <img src="Logo.png" alt="Logo">
          App Rutas</a>
        <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarSupportedContent" aria-controls="navbarSupportedContent" aria-expanded="false" aria-label="Toggle navigation">
          <span class="navbar-toggler-icon"></span>
        </button>
        <div class="collapse navbar-collapse" id="navbarSupportedContent">
          <ul class="navbar-nav me-auto mb-2 mb-lg-0">
            <li class="nav-item">
              <a class="nav-link active" aria-current="page" href="/">Inicio</a>
            </li>
            <li class="nav-item">
              <a class="nav-link" href="/about">Conoce mas</a>
            </li>
            <li class="nav-item">
              <a class="nav-link" href="/no-disponible">Contacto</a>
            </li>
            <li class="nav-item">
              <a class="nav-link disabled">Donar</a>
            </li>
          </ul>
          <form class="d-flex" role="search">
            <input class="form-control me-2" type="search" placeholder="Buscar ruta" aria-label="Search">
            <button class="btn btn-outline-success" type="submit">BUSCAR</button>
          </form>
        </div>
      </div>
    </nav>

    <div class="cont">
    @yield('content')
  </div>

<center>
    <footer> 
      <img src="LogoCNombre.png" alt="logo">
    <ul class="nav justify-content-center">
       <li class="nav-item">
        <a class="nav-link" href="/about">Conoce mas</a>
      </li>
      <li class="nav-item">
        <a class="nav-link" href="/no-disponible">Contacto</a>
      </li>
      <li class="nav-item">
              <a class="nav-link disabled">Donar</a>
            </li>
  </ul>

    </footer>
  </center>
</body>
</html>
