// app/routes.js
//var mongoose = require( 'mongoose' );
//var Store    = mongoose.model( 'Store' );

var Books           = require('../app/models/book');
var User            = require('../app/models/user');
var Item            = require('../app/models/item');


module.exports = function(app, passport) {

    //check out
    app.get('/checkout', function(req, res) {
        res.render('checkout.ejs',{
            user  : req.user
        }); // load the index.ejs file

    });


    //delete an item from cart
    app.get(  '/destroy/:id', function ( req, res, next ){

        console.log(req.user.id);
        console.log(req.params.id);
        Item.remove({buyer_id: req.user.id},{book_id: req.params.id}).exec();
        res.redirect('/store');

    });


    // add item to chart
    app.post(  '/cart', isLoggedIn, function(req, res) {

        //try to add to item database
        Books.findById(req.param('addBookID'),function(err, current_book){

            var item = new Item();
            item.price = current_book.proice;
            item.quantity = "1";
            item.price = current_book.price;
            item.modifiedDate = new Date(),
                item.buyer_id = req.user.id,
                item.book_id  = req.param('addBookID');
            item.status   = "incart";

            // save the user
            item.save();

        });

        res.redirect('/store');

    });

    app.get(  '/viewcart', isLoggedIn, function(req, res) {

        //res.render('cart.ejs', {
        //    user : req.user // get the user out of session and pass to template
        //});
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

                        console.log(result[0]['total']);
                }
            }
        );



        Item.find({"buyer_id" : req.user.id}, function(err, item, total){
            res.render('cart.ejs',{
                item  : item,
                user  : req.user


            });
        });
    });



    //routes product page
    app.get(  '/product/:id', isLoggedIn, function(req, res) {

        Books.find({"_id" : req.params.id}, function(err, store_book){
            if(err) { };
            res.render('product.ejs',{
                user  : req.user,
                books : store_book[0]
            });
        });
    });


    // =====================================
    // Book Store SECTION =========================
    // =====================================
    // we will want this protected so you have to be logged in to visit
    // we will use route middleware to verify this (the isLoggedIn function)
    app.get('/store', isLoggedIn, function(req, res) {
        Books.find({language: 'English'}, function(err, store_books){
            if(err) { };
            res.render('store.ejs',{
                user  : req.user,
                books : store_books
            });
        });
    });




	// =====================================
	// HOME PAGE (with login links) ========
	// =====================================
	app.get('/', function(req, res) {
		res.render('index.ejs'); // load the index.ejs file
	});

	// =====================================
	// LOGIN ===============================
	// =====================================
	// show the login form
	app.get('/login', function(req, res) {

		// render the page and pass in any flash data if it exists
		res.render('login.ejs', { message: req.flash('loginMessage') });
	});

	// process the login form
	app.post('/login', passport.authenticate('local-login', {
		successRedirect : '/store', // redirect to the secure profile section
		failureRedirect : '/login', // redirect back to the signup page if there is an error
		failureFlash : true // allow flash messages
	}));

	// =====================================
	// SIGNUP ==============================
	// =====================================
	// show the signup form
	app.get('/signup', function(req, res) {

		// render the page and pass in any flash data if it exists
		res.render('signup.ejs', { message: req.flash('signupMessage') });
	});

	// process the signup form
	app.post('/signup', passport.authenticate('local-signup', {
		successRedirect : '/store', // redirect to the secure profile section
		failureRedirect : '/signup', // redirect back to the signup page if there is an error
		failureFlash : true // allow flash messages
	}));

	// =====================================
	// PROFILE SECTION =========================
	// =====================================
	// we will want this protected so you have to be logged in to visit
	// we will use route middleware to verify this (the isLoggedIn function)
	app.get('/profile', isLoggedIn, function(req, res) {
		res.render('profile.ejs', {
			user : req.user // get the user out of session and pass to template
		});
	});

	// =====================================
	// LOGOUT ==============================
	// =====================================
	app.get('/logout', function(req, res) {
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


