<?php
$dotenv = parse_ini_file(__DIR__ . '/.env'); // Load env file
define('SEARCH_API_KEY', $dotenv['SEARCH_API_KEY']);
