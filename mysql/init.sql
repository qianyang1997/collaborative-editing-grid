CREATE DATABASE IF NOT EXISTS mysql;

USE mysql;

CREATE TABLE IF NOT EXISTS mysql.UserEdits (
    ID varchar(255) not null,
    message varchar(255) not null,
    unique(ID)
);
