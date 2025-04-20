create table mysql.UserEdits (
    ID varchar(255) not null,
    message varchar(255) not null,
    unique(ID)
);