<?php
namespace MailerAPI;
require_once '../response.php';
require_once '../app.php';

$app = new MailerAPI();

if (!function_exists('getallheaders')) {
  function getallheaders() {
    foreach($_SERVER as $key=>$value) {
      if (substr($key,0,5)=="HTTP_") {
        $key=str_replace(" ","-",ucwords(strtolower(str_replace("_"," ",substr($key,5)))));
        $out[$key]=$value;
      } else {
        $out[$key]=$value;
      }
    }
    return $out;
  }
}

$apiEndpoint = $_SERVER["REQUEST_URI"];
$requestMethod = $_SERVER['REQUEST_METHOD'];
$headers = getallheaders();
$jsonRequest = file_get_contents('php://input');

$response = $app->HandleRequest($requestMethod, $apiEndpoint, $headers, $jsonRequest);
// var_dump($response);
http_response_code($response->responseCode);
echo $response->BodyToJson();

// echo "API endpoint: {$_SERVER["REQUEST_URI"]}\n";
// echo "json contents: {$jsonRequest}\n";
//
// echo "\nHeaders:\n";
// foreach ($headers as $name => $header) {
//   if (is_string($header)) {
//     echo "{$name}: {$header}\n";
//   }
// }


?>
