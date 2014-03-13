// app/routes.js


//var Books = require('../app/models/book');
var User = require('../app/models/user');
var Item = require('../app/models/item');
var Order = require('../app/models/order');
var mongoose = require('mongoose');
var mysql = require('mysql');

//var DbCache	= require('./models/dbcache.js');

var MicroCache	= require('./models/microcache.js');
var orderCache = new MicroCache();
var bookCache = new MicroCache();

var connection = mysql.createConnection({
    host     : 'localhost',
    user     : 'root',
    password : '',
    database : 'node'
});


module.exports = function (app, passport) {

    //get connection
    connection.connect();
    mongoose.connect( 'mongodb://localhost/amazon-store', { server: { poolSize: 1}} );



    //route to order page
    app.get('/destroy/:id', isLoggedIn, function (req, res) {
        Item.remove({buyer_id: req.user.id},{book_id: req.params.id} ).exec();
        res.redirect('/store');
    });


    //route to order page
    app.get('/order/:id', isLoggedIn, function (req, res) {

        if (orderCache.contains(req.params.id)) {
            var odr = orderCache.get(req.params.id);
            res.render('order.ejs', {
                user: req.user,
                order: odr
            });
        } else {
            Order.find({"_id": req.params.id}, function (err, order) {
                if (err) {
                };
                orderCache.set(req.params.id, order[0]);
                res.render('order.ejs', {
                    user: req.user,
                    order: order[0]
                });
            });
        }

    });



    // check out
    app.post('/done', isLoggedIn, function (req, res) {

        //try to add to item database

        //get new order
        var order = new Order();
        order.transactionDate = new Date();
        order.shopper_id = req.user.id;
        order.shopper_fn = req.param('firstName');
        order.shopper_ln = req.param('lastName');
        order.shopper_add = req.param('address');
        order.shopper_phone = req.param('phone');
        order.shopper_email = req.param('email');
        order.shopper_CC_Number = req.param('CCNo');
        order.shopper_CC_Exp_Month = req.param('CCExpiresMonth');
        order.shopper_CC_Exp_Year = req.param('CCExpiresYear');
        order.items.push(req.param('items'));
        order.save();

        // get total
        Item.aggregate([
            { $group: {
                _id: '$buyer_id',
                total: { $sum: '$price'}
            }
            }
        ], function (err, result) {
            if (err) {
                //console.error(err);
            } else {

                order.total = result[0]['total'];
                order.save();
            }
        });





        //decrease book quantity
        Item.find({buyer_id: req.user.id}, function (err, items) {

            items.forEach((function(item) {
                //Books.update({_id: item.book_id},{$inc: {stock: -1}}).exec();


                connection.query('UPDATE amazon_book SET stock = stock - 1 WHERE id = '+ item.book_id, function(err, rows, fields) {
                    if (err) throw err;
                    Item.remove({buyer_id: req.user.id}).exec();
                });

            }));

        });


            //remove checked out book from database item


        res.redirect('/store');

    });

    app.get('/checkout', isLoggedIn, function (req, res) {

        Item.find({"buyer_id": req.user.id}, function (err, item) {
            res.render('checkout.ejs', {
                item: item,
                user: req.user
            });
        });


    });


    //delete an item from cart

    // add item to chart
    app.post('/cart', isLoggedIn, function (req, res) {
        var item          = new Item();
        item.quantity     = "1";
        item.modifiedDate = new Date(),
        item.buyer_id     = req.user.id,
        item.book_id      = req.param('addBookID');

        //search from mysql amazon_book
        if (bookCache.contains(req.param('addBookID'))) {
            var book = bookCache.get(req.param('addBookID'));
            item.price        = book.price;
            item.book_author  = book.author;
            item.book_title   = book.title;
        } else {
            connection.query('SELECT * from amazon_book WHERE id =' + req.param('addBookID'), function(err, rows, fields) {
            item.price        = rows[0].price;
            item.book_author  = rows[0].author;
            item.book_title   = rows[0].title;

        });}
        item.save();
        res.redirect('/store');
    });

    app.get('/viewcart', isLoggedIn, function (req, res) {


        ////try to sum the total price

        Item.aggregate([
            { $group: {
                _id: '$buyer_id',
                total: { $sum: '$price'}
            }}
        ], function (err, result) {
                if (err) {
                    //console.error(err);
                } else {

                    //console.log(result[0]['total']);
                }
            }
        );


        Item.find({"buyer_id": req.user.id}, function (err, item, total) {
            res.render('cart.ejs', {
                item: item,
                user: req.user
            });
        });


    });


    //routes product page
    app.get('/product/:id', isLoggedIn, function (req, res) {


        connection.query('SELECT * from amazon_book WHERE id =' + req.params.id, function(err, rows, fields) {
            if (err) throw err;

            res.render('product.ejs', {
                user: req.user,
                books: rows[0]
            });

        });

    });


    // =====================================
    // Book Store SECTION =========================
    // =====================================
    // we will want this protected so you have to be logged in to visit
    // we will use route middleware to verify this (the isLoggedIn function)
    app.get('/store', isLoggedIn, function (req, res) {
        if (bookCache.isEmpty()) {
            connection.query('SELECT * from amazon_book', function(err, rows, fields) {
                if (err) throw err;

                res.render('store.ejs', {
                    user: req.user,
                    books: rows
                });

                rows.map(function (book) {
                   bookCache.set(book.id, book);
                });


            })
        } else {
            var books = bookCache.getAll();
            res.render('store.ejs', {
                user: req.user,
                books: books
            });
        }
    }
);


    // =====================================
    // HOME PAGE (with login links) ========
    // =====================================
    app.get('/', function (req, res) {
        res.render('index.ejs'); // load the index.ejs file
    });

    // =====================================
    // LOGIN ===============================
    // =====================================
    // show the login form
    app.get('/login', function (req, res) {

        // render the page and pass in any flash data if it exists
        res.render('login.ejs', { message: req.flash('loginMessage') });
    });

    // process the login form
    app.post('/login', passport.authenticate('local-login', {
        successRedirect: '/store', // redirect to the secure profile section
        failureRedirect: '/login', // redirect back to the signup page if there is an error
        failureFlash: true // allow flash messages
    }));

    // =====================================
    // SIGNUP ==============================
    // =====================================
    // show the signup form
    app.get('/signup', function (req, res) {

        // render the page and pass in any flash data if it exists
        res.render('signup.ejs', { message: req.flash('signupMessage') });
    });

    // process the signup form
    app.post('/signup', passport.authenticate('local-signup', {
        successRedirect: '/store', // redirect to the secure profile section
        failureRedirect: '/signup', // redirect back to the signup page if there is an error
        failureFlash: true // allow flash messages
    }));

    // =====================================
    // PROFILE SECTION =========================
    // =====================================
    // we will want this protected so you have to be logged in to visit
    // we will use route middleware to verify this (the isLoggedIn function)
    app.get('/profile', isLoggedIn, function (req, res) {

        Order.find({"shopper_id": req.user.id}, function (err, order) {
            res.render('profile.ejs', {
                order: order,
                user: req.user
            });
        });


//        res.render('profile.ejs', {
//            user: req.user // get the user out of session and pass to template
//        });
    });

    // =====================================
    // LOGOUT ==============================
    // =====================================
    app.get('/logout', function (req, res) {
        req.logout();
        res.redirect('/');


    });
};

// route middleware to make sure
function isLoggedIn(req, res, next) {

    // if user is authenticated in the session, carry on
    if (req.isAuthenticated())
        return next();

    // if they aren't redirect them to the home page
    res.redirect('/');
}


