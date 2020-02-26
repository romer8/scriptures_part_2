/*============================================================================
 * FILE:    scriptures.js
 * AUTHOR:  Elkin Giovanni Romero
 * DATE:    Winter 2020
 *
 * DESCRIPTION: Front-end JavaScript code for The Scriptures, Mapped.
 *              IS 542, Winter 2020, BYU.
 */
/*property
    Animation, DROP, LatLng, LatLngBounds, Marker, abs, align, animation,
    appendChild, body, books, catch, changeHash, children, classKey,
    clearTimeout, content, createHTMLDocument, exec, extend, fitBounds,
    fontColor, fontSize, forEach, freeze, fullName, getAttribute, getCenter,
    getElementById, getPosition, getTitle, google, gridName, hash, href, id,
    implementation, includes, init, innerHTML, json, lat, length, lng, log, map,
    maps, maxBookId, message, minBookId, numChapters, ok, onHashChanged,
    onclick, panTo, parentBookId, position, push, querySelectorAll, round,
    setMap, setTimeout, setTitle, setZoom, showLocation, slice, split,
    strokeColor, text, then, title, tocName, pvolume, pchapter, pbook, from,
    getElementsByClassName, style, visibility, animate, transform, duration

*/

/*global console, google, map, MapLabel, MapLabelInit */
/*jslint
    browser: true
    long: true */

/*------------------------------------------------------------------------
 *                      CONSTANTS
 */
const BOTTOM_PADDING = "<br /><br />";
const CLASS_BOOKS = "books";
const CLASS_BUTTON = "btn";
const CLASS_CHAPTER = "chapter";
const CLASS_ICON = "material-icons";
const CLASS_VOLUME = "volume";
const DIV_BREADCRUMBS = "crumbs";
const DIV_SCRIPTURES_NAVIGATOR = "scripnav";
const DIV_SCRIPTURES = "scriptures";
const ICON_NEXT = "skip_next";
const ICON_PREVIOUS = "skip_previous";
const INDEX_LATITUDE = 3;
const INDEX_LONGITUDE = 4;
const INDEX_PLACE_FLAG = 11;
const INDEX_PLACENAME = 2;
const LAT_LON_PARSER = /\((.*),'(.*)',(.*),(.*),(.*),(.*),(.*),(.*),(.*),(.*),'(.*)'\)/;
const MAX_RETRY_DELAY = 5000;
const MAX_ZOOM_LEVEL = 18;
const MIN_ZOOM_LEVEL = 6;
const TAG_ITALICS = "i";
const TAG_LIST_ITEM = "li";
const TAG_UNORDERED_LIST = "ul";
const TAG_VOLUME_HEADER = "h5";
const TEXT_TOP_LEVEL = "The Scriptures";
const URL_BOOKS = "https://scriptures.byu.edu/mapscrip/model/books.php";
const URL_SCRIPTURES = "https://scriptures.byu.edu/mapscrip/mapgetscrip.php";
const URL_VOLUMES = "https://scriptures.byu.edu/mapscrip/model/volumes.php";
const ZOOM_RATIO = 450;

/*------------------------------------------------------------------------
 *                      PRIVATE VARIABLES
 */
let books;
let gmLabels = [];
let gmMarkers = [];
let initializedMapLabel = false;
let requestedBreadcrumbs;
let requestedNextPrevious;
let retryDelay = 500;
let volumes;
let actual_hash={
  pvolume:"none",
  pbook:"none",
  pchapter:"none"
};
let slideDirection = true;
//this will tell us if the acutal volume, book, and chapter, so when the change is done the animation changes as well.

/*------------------------------------------------------------------------
 *                      PRIVATE METHODS
 */
const addMarker = function (placename, latitude, longitude) {
    let index = markerIndex(latitude, longitude);

    if (index >= 0) {
        mergePlacename(placename, index);
    } else {
        let marker = new google.maps.Marker({
            position: {lat: Number(latitude), lng: Number(longitude)},
            map,
            title: placename,
            animation: google.maps.Animation.DROP
        });

        gmMarkers.push(marker);

        if (!initializedMapLabel) {
            if (typeof MapLabelInit === "function") {
                const initializeLibrary = MapLabelInit;

                initializeLibrary();
                initializedMapLabel = true;
            }
        }

        let mapLabel = new MapLabel({
            text: marker.getTitle(),
            position: new google.maps.LatLng(Number(latitude), Number(longitude)),
            map,
            fontSize: 16,
            fontColor: "#201000",
            strokeColor: "#fff8f0",
            align: "left"
        });

        gmLabels.push(mapLabel);
    }
};

const bookChapterValid = function (bookId, chapter) {
    let book = books[bookId];

    if (book === undefined || chapter < 0 || chapter > book.numChapters) {
        return false;
    }

    if (chapter === 0 && book.numChapters > 0) {
        return false;
    }

    return true;
};

const booksGrid = function (volume) {
    return htmlDiv({
        classKey: CLASS_BOOKS,
        content: booksGridContent(volume)
    });
};

const booksGridContent = function (volume) {
    let gridContent = "";

    volume.books.forEach(function (book) {
        gridContent += htmlLink({
            classKey: CLASS_BUTTON,
            id: book.id,
            href: `#${volume.id}:${book.id}`,
            content: book.gridName
        });
    });

    return gridContent;
};

const breadcrumbs = function (volume, book, chapter) {
    let crumbs;

    if (volume === undefined) {
        crumbs = htmlElement(TAG_LIST_ITEM, TEXT_TOP_LEVEL);
    } else {
        crumbs = htmlElement(TAG_LIST_ITEM, htmlHashLink("", TEXT_TOP_LEVEL));

        if (book === undefined) {
            crumbs += htmlElement(TAG_LIST_ITEM, volume.fullName);
        } else {
            crumbs += htmlElement(TAG_LIST_ITEM, htmlHashLink(`${volume.id}`, volume.fullName));

            if (chapter === undefined || chapter <= 0) {
                crumbs += htmlElement(TAG_LIST_ITEM, book.tocName);
            } else {
                crumbs += htmlElement(TAG_LIST_ITEM, htmlHashLink(`${volume.id},${book.id}`, book.tocName));
                crumbs += htmlElement(TAG_LIST_ITEM, chapter);
            }
        }
    }

    return htmlElement(TAG_UNORDERED_LIST, crumbs);
};

const cacheBooks = function (onInitializedCallback) {
    volumes.forEach(function (volume) {
        let volumeBooks = [];
        let bookId = volume.minBookId;

        while (bookId <= volume.maxBookId) {
            volumeBooks.push(books[bookId]);
            bookId += 1;
        }

        volume.books = volumeBooks;
    });

    if (typeof onInitializedCallback === "function") {
        onInitializedCallback();
    }
};

const changeHash = function (volumeId, bookId, chapter) {
    let newHash = "";

    if (volumeId !== undefined) {
        newHash += volumeId;

        if (bookId !== undefined) {
            newHash += `:${bookId}`;

            if (chapter !== undefined) {
                newHash += `:${chapter}`;
            }
        }
    }

    location.hash = newHash;

};

const chaptersGrid = function (book) {
    return htmlDiv({
        classKey: CLASS_VOLUME,
        content: htmlElement(TAG_VOLUME_HEADER, book.fullName)
    }) + htmlDiv({
        classKey: CLASS_BOOKS,
        content: chaptersGridContent(book)
    });
};

const chaptersGridContent = function (book) {
    let gridContent = "";
    let chapter = 1;

    while (chapter <= book.numChapters) {
        gridContent += htmlLink({
            classKey: `${CLASS_BUTTON} ${CLASS_CHAPTER}`,
            id: chapter,
            href: `#0:${book.id}:${chapter}`,
            content: chapter
        });

        chapter += 1;
    }

    return gridContent;
};

const clearMarkers = function () {
    gmLabels.forEach(function (marker) {
        marker.setMap(null);
    });
    gmMarkers.forEach(function (marker) {
        marker.setMap(null);
    });

    gmMarkers = [];
};

const encodedScripturesUrlParameters = function (bookId, chapter, verses, isJst) {
    if (bookId !== undefined && chapter !== undefined) {
        let options = "";

        if (verses !== undefined) {
            options += verses;
        }

        if (isJst !== undefined && isJst) {
            options += "&jst=JST";
        }

        return `${URL_SCRIPTURES}?book=${bookId}&chap=${chapter}&verses${options}`;
    }
};

const getScripturesCallback = function (chapterHtml) {

    document.getElementById(DIV_SCRIPTURES).innerHTML = chapterHtml;
    // document.getElementById("scriptures2").innerHTML = chapterHtml;
    document.querySelectorAll(".navheading").forEach(function (element) {
        element.appendChild(parseHtml(`<div class="nextprev">${requestedNextPrevious}</div>`)[0]);
    });
    document.getElementById(DIV_BREADCRUMBS).innerHTML = requestedBreadcrumbs;

    let contenido = Array.from(document.getElementsByClassName("scripturecontent"))[0];
    if(slideDirection){
      contenido.style.visibility = "visible";
      if(contenido !== undefined){
        contenido.animate([
          // keyframes
              { transform: "translateX(100%)" },
              { transform: "translateX(0px)" }
              ],
              {
              // timing options
              duration: 300,
            });
      }
    }
    if(!slideDirection){
      contenido.style.visibility = "visible";
      if(contenido !== undefined){
        contenido.animate([
          // keyframes
              { transform: "translateX(-100%)" },
              { transform: "translateX(0px)" }
              ],
              {
              // timing options
              duration: 300,
            });
      }
    }

    setupMarkers();
};

const htmlAnchor = function (volume) {
    return `<a name="v${volume.id}" />`;
};

const htmlDiv = function (parameters) {
    let classString = "";
    let contentString = "";
    let idString = "";

    if (parameters.classKey !== undefined) {
        classString = ` class="${parameters.classKey}"`;
    }

    if (parameters.content !== undefined) {
        contentString = parameters.content;
    }

    if (parameters.id !== undefined) {
        idString = ` id="${parameters.id}"`;
    }

    return `<div${idString}${classString}>${contentString}</div>`;
};

const htmlElement = function (tagName, content, classKey) {
    let classString = "";

    if (classKey !== undefined) {
        classString = ` class="${classKey}"`;
    }

    return `<${tagName}${classString}>${content}</${tagName}>`;
};

const htmlHashLink = function (hashArguments, content, title) {
    let linkConfiguration = {
        content,
        href: "javascript:void(0)",
        onclick: `changeHash(${hashArguments})`
    };

    if (title !== undefined) {
        linkConfiguration.title = title;
    }

    return htmlLink(linkConfiguration);
};

const htmlLink = function (parameters) {
    let classString = "";
    let contentString = "";
    let hrefString = "";
    let idString = "";
    let onclickString = "";
    let titleString = "";

    if (parameters.classKey !== undefined) {
        classString = ` class="${parameters.classKey}"`;
    }

    if (parameters.content !== undefined) {
        contentString = parameters.content;
    }

    if (parameters.href !== undefined) {
        hrefString = ` href="${parameters.href}"`;
    }

    if (parameters.id !== undefined) {
        idString = ` id="${parameters.id}"`;
    }

    if (parameters.onclick !== undefined) {
        onclickString = ` onclick="${parameters.onclick}"`;
    }

    if (parameters.title !== undefined) {
        titleString = ` title="${parameters.title}"`;
    }

    return `<a${idString}${classString}${hrefString}${onclickString}${titleString}>${contentString}</a>`;
};

const init = function (onInitializedCallback) {
    let booksLoaded = false;
    let volumesLoaded = false;

    fetch(URL_BOOKS).then(function (response) {
        if (response.ok) {
            return response.json();
        }

        throw new Error("Unable to retrieve required data from server.");
    }).then(function (booksObject) {
        books = booksObject;
        booksLoaded = true;

        if (volumesLoaded) {
            cacheBooks(onInitializedCallback);
        }
    }).catch(function (error) {
        console.log("Error: ", error.message);
    });

    fetch(URL_VOLUMES).then(function (response) {
        if (response.ok) {
            return response.json();
        }

        throw new Error("Unable to retrieve required data from server.");
    }).then(function (volumesArray) {
        volumes = volumesArray;
        volumesLoaded = true;

        if (booksLoaded) {
            cacheBooks(onInitializedCallback);
        }
    }).catch(function (error) {
        console.log("Error: ", error.message);
    });
};

const markerIndex = function (latitude, longitude) {
    let i = gmMarkers.length - 1;

    while (i >= 0) {
        let marker = gmMarkers[i];

        // Note: here is the safe way to compare IEEE floating-point
        // numbers: compare their difference to a small number
        const latitudeDelta = Math.abs(marker.getPosition().lat() - latitude);
        const longitudeDelta = Math.abs(marker.getPosition().lng() - longitude);

        if (latitudeDelta < 0.00000001 && longitudeDelta < 0.00000001) {
            return i;
        }

        i -= 1;
    }

    return -1;
};

const mergePlacename = function (placename, index) {
    let marker = gmMarkers[index];
    let label = gmLabels[index];
    let title = marker.getTitle();

    if (!title.includes(placename)) {
        title += ", " + placename;
        marker.setTitle(title);
        label.text = title;
    }
};

const navigateBook = function (bookId) {
    let contenido =document.getElementById("scripnav");
    if(contenido !== null){
      contenido.style.visibility = "hidden";
    }

    let book = books[bookId];
    let volume;
    actual_hash.pbook=bookId;
    if (book.numChapters <= 1) {
        navigateChapter(book.id, book.numChapters);
    } else {
        if (book !== undefined) {
            volume = volumeForId(book.parentBookId);
        }

        transitionScriptures(htmlDiv({
            id: DIV_SCRIPTURES_NAVIGATOR,
            content: chaptersGrid(book)
        }));
        transitionBreadcrumbs(breadcrumbs(volume, book));
    }
};

const navigateChapter = function (bookId, chapter) {
    if (bookId !== undefined) {
        let contenido =  Array.from(document.getElementsByClassName("scripturecontent"))[0]
        if(contenido !== undefined){
          console.log("hidden");
          contenido.style.visibility = "hidden";
        }
        actual_hash.pchapter=chapter;
        console.log(actual_hash.pchapter);
        let book = books[bookId];
        let volume = volumes[book.parentBookId - 1];

        requestedBreadcrumbs = breadcrumbs(volume, book, chapter);

        let nextPrev = previousChapter(bookId, chapter);

        if (nextPrev === undefined) {
            requestedNextPrevious = "";
        } else {
            requestedNextPrevious = nextPreviousMarkup(nextPrev, ICON_PREVIOUS);
        }

        nextPrev = nextChapter(bookId, chapter);

        if (nextPrev !== undefined) {
            requestedNextPrevious += nextPreviousMarkup(nextPrev, ICON_NEXT);
        }
        // contenido.style.visibility = "hidden";
        fetch(encodedScripturesUrlParameters(bookId, chapter)).then(function (response) {
            if (response.ok) {
                return response.text();
            }

            throw new Error("Unable to retrieve chapter information from server.");
        }).then((html) => getScripturesCallback(html)).catch(function (error) {
            console.log("Error: ", error.message);
        });
    }
};

const navigateHome = function (volumeId) {

    document.getElementById(DIV_SCRIPTURES).innerHTML = htmlDiv({
        id: DIV_SCRIPTURES_NAVIGATOR,
        content: volumesGridContent(volumeId)
    });

    document.getElementById(DIV_BREADCRUMBS).innerHTML = breadcrumbs(volumeForId(volumeId));
    actual_hash.pvolume=volumeId;
    let element =document.getElementById("scripnav");

    var op = 0.1;  // initial opacity
    if(element !== null){
    element.style.opacity = op;
    element.style.filter = "alpha(opacity=" + op * 100 + ")";
    var timer = setInterval(function () {
        if (op >= 1){
            clearInterval(timer);
        }
        element.style.opacity = op;
        element.style.filter = "alpha(opacity=" + op * 100 + ")";
        op += op * 0.1;
    }, 40);
  }
};

// Book ID and chapter must be integers
// Returns undefined if there is no next chapter
// Otherwise returns an array with the next book ID, chapter, and title
const nextChapter = function (bookId, chapter) {
    let book = books[bookId];

    if (book !== undefined) {

        if (chapter < book.numChapters) {
            return [
                bookId,
                chapter + 1,
                titleForBookChapter(book, chapter + 1)
            ];
        }

        let nextBook = books[bookId + 1];

        if (nextBook !== undefined) {
            let nextChapterValue = 0;

            if (nextBook.numChapters > 0) {
                nextChapterValue = 1;
            }

            return [
                nextBook.id,
                nextChapterValue,
                titleForBookChapter(nextBook, nextChapterValue)
            ];
        }
    }
};

const nextPreviousMarkup = function (nextPrev, icon) {
    return htmlHashLink(
        `0, ${nextPrev[0]}, ${nextPrev[1]}`,
        htmlElement(TAG_ITALICS, icon, CLASS_ICON),
        nextPrev[2]
    );
};

// We're expecting a hash value of the form #volume:book:chapter,
// where each of the three parameters is optional.
const onHashChanged = function () {
    // let element = document.getElementById("scriptures");

    let ids = [];

    if (location.hash !== "" && location.hash.length > 1) {
        ids = location.hash.slice(1).split(":");
    }

    if (ids.length <= 0) {
      // do the fading here //
        let element = document.getElementById("scripnav");
        if(element !== null){
          // let element = document.getElementById("scriptures");
          var op = 1;  // initial opacity
          var timer = setInterval(function () {
             if (op <= 0.1){
                 clearInterval(timer);
                 element.style.visibility = "hidden";
                 console.log(" I am fading out fro");
             }
             element.style.opacity = op;
             element.style.filter = "alpha(opacity=" + op * 100 + ")";
             op -= op * 0.1;
          }, 40);

        }
        setTimeout(function(){
          navigateHome();
        },1500);

    } else if (ids.length === 1) {
        let volumeId = Number(ids[0]);

        if (volumeId < volumes[0].id || volumeId > volumes.slice(-1).id) {
          // do the fading here //
            let element = document.getElementById("scripnav");
            if(element !== null){
              // let element = document.getElementById("scriptures");
              var op = 1;  // initial opacity
              var timer = setInterval(function () {
                 if (op <= 0.1){
                     clearInterval(timer);
                     element.style.visibility = "hidden";
                     console.log(" I am fading out fro");
                 }
                 element.style.opacity = op;
                 element.style.filter = "alpha(opacity=" + op * 100 + ")";
                 op -= op * 0.1;
              }, 40);

            }
            setTimeout(function(){
              navigateHome();
            },1500);
        } else {
          // do the fading here //
            let element = document.getElementById("scripnav");
            if(element !== null){
              // let element = document.getElementById("scriptures");
              var op = 1;  // initial opacity
              var timer = setInterval(function () {
                 if (op <= 0.1){
                     clearInterval(timer);
                     element.style.visibility = "hidden";
                 }
                 element.style.opacity = op;
                 element.style.filter = "alpha(opacity=" + op * 100 + ")";
                 op -= op * 0.1;
              }, 40);

            }
            setTimeout(function(){
              navigateHome(volumeId);
            },1500);
        }
    } else if (ids.length >= 2) {
        let bookId = Number(ids[1]);

        if (books[bookId] === undefined) {
            // do the fading here //
            let element = document.getElementById("scripnav");
            if(element !== null){
              // let element = document.getElementById("scriptures");
              var op = 1;  // initial opacity
              var timer = setInterval(function () {
                 if (op <= 0.1){
                     clearInterval(timer);
                     element.style.visibility = "hidden";
                 }
                 element.style.opacity = op;
                 element.style.filter = "alpha(opacity=" + op * 100 + ")";
                 op -= op * 0.1;
              }, 40);

            }
            setTimeout(function(){
              navigateHome();
            },1500);
        } else {
            if (ids.length === 2) {
                let element = document.getElementById("scripnav");
                if(element !== null){
                  // let element = document.getElementById("scriptures");
                  var op = 1;  // initial opacity
                  var timer = setInterval(function () {
                     if (op <= 0.1){
                         clearInterval(timer);
                         element.style.visibility = "hidden";
                     }
                     element.style.opacity = op;
                     element.style.filter = "alpha(opacity=" + op * 100 + ")";
                     op -= op * 0.1;
                  }, 40);

                }

                setTimeout(function(){
                    navigateBook(bookId);
                },1500);

            } else {
                let chapter = Number(ids[2]);

                if (bookChapterValid(bookId, chapter)) {

                    let contenido = Array.from(document.getElementsByClassName("scripturecontent"))[0];

                    if(contenido !== undefined){

                      if(actual_hash.pchapter > chapter){
                        slideDirection = false;
                        // here the animation to leave from left to right//

                        contenido.animate([
                          // keyframes
                              { transform: "translateX(0)" },
                              { transform: "translateX(100%)" }
                              ],
                              {
                              // timing options
                              duration: 300,
                            });
                      }
                      if(actual_hash.pchapter < chapter){
                        slideDirection = true;
                        // here the animation to leave from right to left //
                        // here the animation to leave from left to right//
                        contenido.animate([
                          // keyframes
                              { transform: "translateX(0)" },
                              { transform: "translateX(-100%)" }
                              ],
                              {
                              // timing options
                              duration: 300,
                            });
                      }

                    }


                    setTimeout(function(){
                        navigateChapter(bookId, chapter);
                    },300);

                    //CHANGE THE STYLE TO THE ANIMATION IF IT IS A CHAPTER LESS OR MORE ///
                } else {
                  let element = document.getElementById("scripnav");
                  if(element !== null){
                    var op = 1;  // initial opacity
                    var timer = setInterval(function () {
                       if (op <= 0.1){
                           clearInterval(timer);
                           element.style.visibility = "hidden";
                           console.log(" I am fading out fro");
                       }
                       element.style.opacity = op;
                       element.style.filter = "alpha(opacity=" + op * 100 + ")";
                       op -= op * 0.1;
                    }, 40);

                  }
                  setTimeout(function(){
                    navigateHome();
                  },1500);
                }
            }
        }
    }
};

const parseHtml = function (html) {
    let htmlDocument = document.implementation.createHTMLDocument();

    htmlDocument.body.innerHTML = html;

    return htmlDocument.body.children;
};

// Book ID and chapter must be integers
// Returns undefined if there is no previous chapter
// Otherwise returns an array with the next book ID, chapter, and title
const previousChapter = function (bookId, chapter) {
    let book = books[bookId];

    if (book !== undefined) {
        if (chapter > 1) {
            return [bookId, chapter - 1, titleForBookChapter(book, chapter - 1)];
        }

        let previousBook = books[bookId - 1];

        if (previousBook !== undefined) {
            return [
                previousBook.id,
                previousBook.numChapters,
                titleForBookChapter(previousBook, previousBook.numChapters)
            ];
        }
    }
};

const setupMarkers = function () {
    if (window.google === undefined) {
        let retryId = window.setTimeout(setupMarkers, retryDelay);

        retryDelay += retryDelay;

        if (retryDelay > MAX_RETRY_DELAY) {
            window.clearTimeout(retryId);
        }

        return;
    }

    if (gmMarkers.length > 0) {
        clearMarkers();
    }

    let matches;

    document.querySelectorAll("a[onclick^=\"showLocation(\"]").forEach(function (element) {
        matches = LAT_LON_PARSER.exec(element.getAttribute("onclick"));

        if (matches) {
            let placename = matches[INDEX_PLACENAME];
            let latitude = parseFloat(matches[INDEX_LATITUDE]);
            let longitude = parseFloat(matches[INDEX_LONGITUDE]);
            let flag = matches[INDEX_PLACE_FLAG];

            if (flag !== "") {
                placename += " " + flag;
            }

            addMarker(placename, latitude, longitude);
        }
    });

    if (gmMarkers.length > 0) {
        if (gmMarkers.length === 1 && matches) {
            // When there's exactly one marker, add it and zoom to it
            let zoomLevel = Math.round(Number(matches[9]) / ZOOM_RATIO);

            if (zoomLevel < MIN_ZOOM_LEVEL) {
                zoomLevel = MIN_ZOOM_LEVEL;
            } else if (zoomLevel > MAX_ZOOM_LEVEL) {
                zoomLevel = MAX_ZOOM_LEVEL;
            }

            map.setZoom(zoomLevel);
            map.panTo(gmMarkers[0].position);
        } else {
            let bounds = new google.maps.LatLngBounds();

            gmMarkers.forEach(function (marker) {
                bounds.extend(marker.position);
            });

            map.panTo(bounds.getCenter());
            map.fitBounds(bounds);
        }
    }
};

const showLocation = function (id, placename, latitude, longitude, viewLatitude, viewLongitude, viewTilt, viewRoll, viewAltitude, viewHeading) {
    console.log(`${id} ${placename} ${viewLatitude} ${viewLongitude}`);
    console.log(`${viewTilt} ${viewRoll} ${viewHeading}`);
    map.panTo({lat: latitude, lng: longitude});
    map.setZoom(Math.round(viewAltitude / ZOOM_RATIO));
};

const titleForBookChapter = function (book, chapter) {
    if (chapter > 0) {
        return book.tocName + " " + chapter;
    }

    return book.tocName;
};

const transitionBreadcrumbs = function (newCrumbs) {
    document.getElementById(DIV_BREADCRUMBS).innerHTML = newCrumbs;
};

const transitionScriptures = function (newContent) {

    document.getElementById(DIV_SCRIPTURES).innerHTML = htmlDiv({content: newContent});
    let element = document.getElementById("scripnav");
    var op = 0.1;  // initial opacity

    element.style.opacity = op;
    element.style.filter = "alpha(opacity=" + op * 100 + ")";
    var timer = setInterval(function () {
        if (op >= 1){
            clearInterval(timer);
        }
        element.style.opacity = op;
        element.style.filter = "alpha(opacity=" + op * 100 + ")";
        op += op * 0.1;
    }, 40);

    setupMarkers(newContent);
    // animation to fade new content in  // I guess ///


};

const volumeForId = function (volumeId) {
    if (volumeId !== undefined && volumeId > 0 && volumeId <= volumes.length) {
        return volumes[volumeId - 1];
    }
};

const volumesGridContent = function (volumeId) {
    let gridContent = "";

    volumes.forEach(function (volume) {
        if (volumeId === undefined || volumeId === volume.id) {
            gridContent += htmlDiv({
                classKey: CLASS_VOLUME,
                content: htmlAnchor(volume) + htmlElement(TAG_VOLUME_HEADER, volume.fullName)
            });

            gridContent += booksGrid(volume);
        }
    });

    return gridContent + BOTTOM_PADDING;
};

/*------------------------------------------------------------------------
 *                      PUBLIC API
 */
const Scriptures = {
    changeHash,
    init,
    onHashChanged,
    showLocation
};

export default Object.freeze(Scriptures);
