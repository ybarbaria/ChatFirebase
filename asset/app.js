(function(jQuery, Firebase, Path) {
    "use strict";

    // firebase authent 
    var ref = new Firebase('https://blazing-fire-6697.firebaseio.com/web/uauth');

    // FLag création nouvel user
    var newUser = false;

    // Flag nouvelle session
    var newSession = false;

    // Donnée de l'user connecté
    var userProfil;

    var controllers = {};
    var activeForm = null;

    // Définition des routes des éléments de la page
    var routeMap = {
        '#/login': {
            form: 'frmLogin',
            controller: 'login'
        },
        '#/logout': {
            form: 'frmLogout',
            controller: 'logout'
        },
        '#/register': {
            form: 'frmRegister',
            controller: 'register'
        },
        '#/chat': {
            form: 'frmChat',
            controller: 'chat',
            authRequired: true
        },
        '#/profile': {
            form: 'frmProfile',
            controller: 'profile',
            authRequired: true
        },
        '#/channel': {
            form: 'frmChannel',
            controller: 'channel',
            authRequired: true
        },
        '#/': {
            form: 'frmLogin',
            controller: 'login',
            authRequired: true
        },
    };

    /** 
     *	@function
     * 	@name routeTo 
     *	Permet de renvoyer vers une adresse de la page
     */
    function routeTo(route) {
        window.location.href = '#/' + route;
    }

    /** 
     *	@function
     * 	@name authWithPassword 
     *	Auth à Firebase avec password
     * 	Retourne une "promise"
     */
    function authWithPassword(userObj) {
        var deferred = $.Deferred();
        ref.authWithPassword(userObj, function onAuth(err, user) {
            if (err) {
                deferred.reject(err);
            }

            if (user) {
                newUser = false;
                newSession = false;
                deferred.resolve(user);
            }

        });

        return deferred.promise();
    }

    /** 
     *	@function
     * 	@name getName 
     *	Récupère les données du profile (users de firebase)
     */
    function getName(authData) {
        switch (authData.provider) {
            case 'password':
                return authData.password.email.replace(/@.*/, '');
        }
    }

    /** 
     *	@function
     * 	@name createUser 
     *	Création d'un utilisateur sans le loger
     *   Retourne une "promise"
     */
    function createUser(userObj) {
        var deferred = $.Deferred();

        // Création de l'utilisateur sur firebase
        ref.createUser(userObj, function(err) {

            if (!err) {
                deferred.resolve();
            } else {
                deferred.reject(err);
            }

        });

        return deferred.promise();
    }

    /** 
     *	@function
     * 	@name createUserAndLogin 
     *	Création d'un user + login
     *   Retourne une "promise"
     */
    function createUserAndLogin(userObj) {
        newUser = true;

        return createUser(userObj)
            .then(function() {
                return authWithPassword(userObj);
            });
    }

    /** 
     *	@function
     * 	@name handleAuthResponse 
     *	Redirige vers la route spécifié en cas de success
     *   Message d'alerte en cas d'erreur
     */
    function handleAuthResponse(promise, route) {
        $.when(promise).then(function(authData) {
            // Redirection
            routeTo(route);

        }, function(err) {
            // toast d'erreur
            $.toaster({
                message: err,
                title: 'Access error',
                priority: 'danger'
            });
            console.log(err);
        });
    }

    ////////////////////////////////////////
    /// Controllers
    ////////////////////////////////////////

    /** 
     *	@controller
     * 	@name login 
     *	Controller responsable de la connexion d'un user
     */
    controllers.login = function(form) {

        // Durant la soumission du formulaire de login 
        // Login via firebase
        form.on('submit', function(e) {

            var user = $(this).serializeObject();
            var loginPromise = authWithPassword(user);

            newSession = false;

            ref.getAuth();
            var userRef;

            e.preventDefault();

            handleAuthResponse(loginPromise, 'chat');

        });
    };

    /** 
     *	@controller
     * 	@name logout 
     *	Controller responsable de la déconnexion
     */
    controllers.logout = function(form) {

        ref.unauth();
    };

    /** 
     *	@controller
     * 	@name register 
     *	Controller responsable de l'enregistrement d'un nouvel user
     */
    controllers.register = function(form) {

        // Soumission du formulaire d'enregistrement et création de l'utilisateur
        form.on('submit', function(e) {

            newSession = false;
        
            var userAndPass = $(this).serializeObject();

            var loginPromise = createUserAndLogin(userAndPass);

            e.preventDefault();

            handleAuthResponse(loginPromise, 'profile');

        });

    };

    /** 
     *	@controller
     * 	@name profile 
     *	Controlleur responsable de la gestion de la page du profil de l'user
     */
    controllers.profile = function(form) {

        // Vérif si l'utilisateur est bien l'utilisateur courant
        var user = ref.getAuth();
        var userRef;
        var formProfile = form;

        // Si ce n'est pas le cas, redirection vers la page de login
        if (!user) {
            $.toaster({
                message: 'You are not logged in !',
                title: 'Access error',
                priority: 'danger'
            });
            routeTo('login');
            return;
        }

        // Chargement des infos utilisateurs
        userRef = ref.child('users').child(user.uid);
        userRef.once('value', function(snap) {
            userProfil = snap.val();

            if (!user) {
                return;
            } else {

                // On renseigne les données du formulaire
                $("#txtName").val(userProfil.name);
                $("#txtEmail").val(userProfil.email);
            }
        });

        // Lors de la soumission du formulaire, mise à jour des données de l'user
        form.on('submit', function(e) {
            e.preventDefault();
            var userInfo = $(this).serializeObject();

            userRef.update(userInfo, function onComplete() {

            });
        });
    }

    /** 
     *	@controller
     * 	@name chat 
     *	Controlleur responsable de la gestion de la page du chat 1 vs 1
     */
    controllers.chat = function(form) {

        var selectUsers = $("#listUsers");

        var messageFieldChat = $('#messageInputChat');
        var nameFieldChat = $('#nameInputChat');
        var messageListChat = $('#messagesChat');

        // On vide le contenu à chaque retour sur la page
        messageListChat.empty();

        // User sélectionnée 
        var userToSend = $('#listUsers :selected').text();

        // Vérification de l'user courant
        var user = ref.getAuth();
        var userRef;

        // Si ce n'est pas l'user on redirige vers la page de login
        if (!user) {
            $.toaster({
                message: '',
                title: 'Access error',
                priority: 'danger'
            });

            routeTo('login');
            return;
        }

        // Load des données de l'user
        userRef = ref.child('users').child(user.uid);
        userRef.once('value', function(snap) {
            userProfil = snap.val();
            if (!userProfil) {
                return;
            }
        });

        var listDataUsers = {
            "users": []
        };
        userRef = ref.child('users');
        userRef.once('value', function(snap) {

            snap.forEach(function(childSnapshot) {

                var childData = childSnapshot.val();
                if (childData.name !== userProfil.name) {
                    var user = {
                        id: childData.email,
                        text: childData.name
                    };
                    listDataUsers.users.push(user);
                }
            });

            // remplissage de la liste de selection via l'object json 
            selectUsers.select2({
                data: listDataUsers.users
            })

            selectUsers.select2().select2("val", null);
        });

        // Envoi du message
        form.on('submit', function(e) {
            var postsRef = ref.child("messageInput");
            var newPostRef = postsRef.push();
            newPostRef.set({
                message: {
                    filter: {
                        author: userProfil.name,
                        to: userToSend
                    },
                    value: messageFieldChat.val()
                }
            });
        });

        selectUsers.on("change", function() {
            // On vide le contenu à chaque retour sur la page
            messageListChat.empty();
            userToSend = $('#listUsers :selected').text();

            ref.child('messageInput').once('value', function(snapshot) {

                snapshot.forEach(function(childSnapshot) {
                    // Création des éléments html 
                    var messageContainer = $("<div class='row'>");
                    var messageElementMe = $("<div class='bubble me col-md-12'>");
                    var messageElementOth = $("<div class='bubble other col-md-12'>");
                    var nameElement = $("<p></p>")
                    var pElement = $("<p></p>")

                    // Recup des données des messages
                    var data = childSnapshot.val().message;
                    var author = data.filter.author;
                    var to = data.filter.to;

                    var message = data.value;

                    nameElement.append(author);
                    pElement.append(message);
                    nameElement.append(pElement)

                    if (to === userProfil.name && author === userToSend) {
                        messageElementOth.append(nameElement);
                        messageContainer.append(messageElementOth)
                        messageListChat.append(messageContainer)
                    }

                    if (author === userProfil.name && to === userToSend) {
                        messageElementMe.append(nameElement);
                        messageContainer.append(messageElementMe)
                        messageListChat.append(messageContainer)
                    }
                });

                // Scroll jusqu'en bas
                messageListChat[0].scrollTop = messageListChat[0].scrollHeight;

            });
        });


        // Ajout d'un listener sur les nouveaux messages enregistrés sur firebase pour l'utilisateur concerné
        ref.child('messageInput').on('child_added', function(snapshot) {

            // On vide le contenu à chaque retour sur la page
            // messageListChat.empty();
            userToSend = $('#listUsers :selected').text();

            if (userToSend) {
                // Création des éléments html 
                var messageContainer = $("<div class='row'>");
                var messageElementMe = $("<div class='bubble me col-md-12'>");
                var messageElementOth = $("<div class='bubble other col-md-12'>");
                var nameElement = $("<p></p>")
                var pElement = $("<p></p>")

                // Recup des données des messages
                var data = snapshot.val().message;
                var author = data.filter.author;
                var to = data.filter.to;

                var message = data.value;

                nameElement.append(author);
                pElement.append(message);
                nameElement.append(pElement)

                if (to === userProfil.name && author === userToSend) {
                    messageElementOth.append(nameElement);
                    messageContainer.append(messageElementOth)
                    messageListChat.append(messageContainer)
                }

                if (author === userProfil.name && to === userToSend) {
                    messageElementMe.append(nameElement);
                    messageContainer.append(messageElementMe)
                    messageListChat.append(messageContainer)
                }

                // Scroll jusqu'en bas
                messageListChat[0].scrollTop = messageListChat[0].scrollHeight;
            }
        });
    };

    /** 
     *	@controller
     * 	@name channel 
     *	Controlleur responsable de la gestion de la page du flux de discussion
     */
    controllers.channel = function(form) {

        // On vide le contenu à chaque retour sur la page
        $('#messages').empty();

        var messageField = $('#messageInput');
        var nameField = $('#nameInput');
        var messageList = $('#messages');

        // Vérification de l'user courant
        var user = ref.getAuth();
        var userRef;
        var formChannel = form;

        // Si ce n'est pas l'user on redirige vers la page de login
        if (!user) {
            $.toaster({
                message: 'Unknow user',
                title: 'Access error',
                priority: 'danger'
            });

            routeTo('login');
            return;
        }

        // Load user info
        userRef = ref.child('users').child(user.uid);
        userRef.once('value', function(snap) {
            userProfil = snap.val();
            if (!userProfil) {
                return;
            }
        });

        // Click sur send
        formChannel.on('submit', function(e) {
            // Get de l'username et message saisi
            var username = userProfil.name;
            var message = messageField.val();

            // Sauvegarde du message sur firebase
            ref.child('message').push({
                name: username,
                text: message
            });
            messageField.val('');
        });

        // Ajout d'un listener sur les nouveaux messages enregistrés sur firebase
        ref.child('message').on('child_added', function(snapshot) {

            // Recup des données des messages
            var data = snapshot.val();
            var username = data.name;
            var message = data.text;

            // Création des éléments html 
            var messageContainer = $("<div class='row'>");
            var messageElementMe = $("<div class='bubble me col-md-12'>");
            var messageElementOth = $("<div class='bubble other col-md-12'>");
            var nameElement = $("<p></p>")
            var pElement = $("<p></p>")

            nameElement.append(username);
            pElement.append(message);
            nameElement.append(pElement)

            // Deux styles différents, un pour les messages de l'user courant,
            // l'autre pour les autres utilisateurss
            if (username == userProfil.name) {
                messageElementMe.append(nameElement);
                messageContainer.append(messageElementMe)
                messageList.append(messageContainer)
            } else {
                messageElementOth.append(nameElement);
                messageContainer.append(messageElementOth)
                messageList.append(messageContainer)
            }

            // Scroll jusqu'en bas
            messageList[0].scrollTop = messageList[0].scrollHeight;
        });
    };

    ////////////////////////////////////////
    /// Routing
    ////////////////////////////////////////

    /** 
     *	@function
     * 	@name transitionRoute 
     *	Fonction principale du routing 
     *	Gère les redirection et l'affichage des formulaires
     */
    function transitionRoute(path) {

        // Gestion de l'ouverture d'un nouvel onglet ou une autre fenetre automatiquement l'user est
        // redirigé vers le login (sauf s'il va directement sur register ou login)
        if (newSession && (path != "#/register" && path != "#/login")) {
            $.toaster({
                message: 'You are not logged in !',
                title: 'Access error',
                priority: 'danger'
            });
            routeTo('login');
            return;
        }

        // Récup des données de la route entrante et l'user connecté 
        var formRoute = routeMap[path];
        var currentUser = ref.getAuth();

        // Si l'authentificationn est nécessaire pour accéder au chemin et que l'user n'est pas connu alors 
        // redirection vers la page de login
        if (formRoute.authRequired && !currentUser) {
            routeTo('login');
            return;
        }

        // Get du formulaire correspondant
        var upcomingForm = $('#' + formRoute.form);

        // On active le formulaire cible si aucun formulaire n'était actif
        if (!activeForm) {
            activeForm = upcomingForm;
        }

        // On cache le formulaire auparavant actif et on affiche le nouveau form
        activeForm.hide();
        upcomingForm.show().hide().fadeIn(400);

        // Desactivation des écouteurs du précépent formulaire
        activeForm.off();

        // On définit le formulaire du path comme actif
        activeForm = upcomingForm;

        // Appel du controller correspondant
        controllers[formRoute.controller](activeForm);
    }

    /** 
     *	@function
     * 	@name prepRoute 
     *	Met en place le changement de route
     */
    function prepRoute() {
        transitionRoute(this.path);
    }

    /// Définition des routes
    ///  #/login    - Login
    //   #/logout   - Logout
    //   #/register - Register
    //   #/chat 	- Chat
    //   #/channel 	- Channel
    //   #/profile  - Profile
    Path.map("#/login").to(prepRoute);
    Path.map("#/logout").to(prepRoute);
    Path.map("#/register").to(prepRoute);
    Path.map("#/chat").to(prepRoute);
    Path.map("#/channel").to(prepRoute);
    Path.map("#/profile").to(prepRoute);
    Path.map("#/").to(prepRoute);

    Path.root("#/");

    ////////////////////////////////////////
    /// Initialize
    ////////////////////////////////////////

    $(function() {

    	// premier chargement de la page on est forcément sur une nouvelle session
        newSession = true;

        // On lance le router
        Path.listen();

        Path.map("#/").to("/#login");

        // Listener d'authification sur firebase
        ref.onAuth(function globalOnAuth(data) {

            if (data && newUser) {

                ref.child("users").child(data.uid).set({
                    provider: data.provider,
                    name: getName(data)
                });
            }
        });

    });

}(window.jQuery, window.Firebase, window.Path))