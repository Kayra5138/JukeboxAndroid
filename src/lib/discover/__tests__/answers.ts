/*
  What ListenBrainz answered on 9 October 2026, cut down to a few rows of each.
  Nothing here is made up and nothing in a test asks the network: the shapes
  the client reads are the shapes that were sent.

  `radio` is /1/lb-radio/artist/ for 妖精帝國 at 0–100, three of its eleven
  artists and the artist itself. `details` is /1/metadata/recording/ for those
  of its recordings that were asked about (the artist's own four were not, so
  they have none — which is also a case). `tagged` is /1/lb-radio/tags for
  j-pop AND symphonic metal. `similar` is the labs similar-artists dataset
  asked by POST about three artists at once.
*/
export const SEED = "d02974dc-b4dc-4691-9705-33929ac731e1";
export const radio: unknown = {
 "9b15ff5e-5bd1-43c2-821d-e31240aad334": [
  {
   "recording_mbid": "7c6b6bbd-bb83-4826-b360-8f24b48e3d6e",
   "similar_artist_mbid": "9b15ff5e-5bd1-43c2-821d-e31240aad334",
   "similar_artist_name": "supercell",
   "total_listen_count": 1543
  },
  {
   "recording_mbid": "4e6f91a3-6c13-436a-8b67-4cc624eb4bc9",
   "similar_artist_mbid": "9b15ff5e-5bd1-43c2-821d-e31240aad334",
   "similar_artist_name": "supercell",
   "total_listen_count": 6
  },
  {
   "recording_mbid": "3b53d311-e51a-4f09-b451-f7505dd54452",
   "similar_artist_mbid": "9b15ff5e-5bd1-43c2-821d-e31240aad334",
   "similar_artist_name": "supercell",
   "total_listen_count": 9840
  },
  {
   "recording_mbid": "43589ed8-083d-46bc-af9e-895f7d7bff0a",
   "similar_artist_mbid": "9b15ff5e-5bd1-43c2-821d-e31240aad334",
   "similar_artist_name": "supercell",
   "total_listen_count": 1098
  },
  {
   "recording_mbid": "57f767db-8671-48de-a679-949fbda2e493",
   "similar_artist_mbid": "9b15ff5e-5bd1-43c2-821d-e31240aad334",
   "similar_artist_name": "supercell",
   "total_listen_count": 24
  },
  {
   "recording_mbid": "6b84dee3-3f3f-4733-8ffb-57284d731066",
   "similar_artist_mbid": "9b15ff5e-5bd1-43c2-821d-e31240aad334",
   "similar_artist_name": "supercell",
   "total_listen_count": 12047
  }
 ],
 "aea6ccea-deb0-44bb-886e-d91aa4c358bf": [
  {
   "recording_mbid": "f4f9c635-32e2-4889-8be9-50814340dcb0",
   "similar_artist_mbid": "aea6ccea-deb0-44bb-886e-d91aa4c358bf",
   "similar_artist_name": "Reol",
   "total_listen_count": 132
  },
  {
   "recording_mbid": "16e12eb0-105a-467c-869e-ec8a243191fe",
   "similar_artist_mbid": "aea6ccea-deb0-44bb-886e-d91aa4c358bf",
   "similar_artist_name": "Reol",
   "total_listen_count": 398
  },
  {
   "recording_mbid": "80b5970e-6d82-40b7-8060-aaac76a2dbeb",
   "similar_artist_mbid": "aea6ccea-deb0-44bb-886e-d91aa4c358bf",
   "similar_artist_name": "Reol",
   "total_listen_count": 1142
  },
  {
   "recording_mbid": "09fcc1eb-a446-498d-b573-0c9424369664",
   "similar_artist_mbid": "aea6ccea-deb0-44bb-886e-d91aa4c358bf",
   "similar_artist_name": "Reol",
   "total_listen_count": 36
  },
  {
   "recording_mbid": "198dfc8d-045e-498b-9abd-a5bb6ff0ef02",
   "similar_artist_mbid": "aea6ccea-deb0-44bb-886e-d91aa4c358bf",
   "similar_artist_name": "Reol",
   "total_listen_count": 1
  },
  {
   "recording_mbid": "4c6cb8f5-d1e4-4dff-80d6-c411894921f1",
   "similar_artist_mbid": "aea6ccea-deb0-44bb-886e-d91aa4c358bf",
   "similar_artist_name": "Reol",
   "total_listen_count": 255
  }
 ],
 "b6c18308-82c7-4ec1-a42d-e8488bce6618": [
  {
   "recording_mbid": "3cd8b79b-4a58-4d4f-af6a-5ae90f5eb8a0",
   "similar_artist_mbid": "b6c18308-82c7-4ec1-a42d-e8488bce6618",
   "similar_artist_name": "坂本真綾",
   "total_listen_count": 121
  },
  {
   "recording_mbid": "e228caad-19ba-4f15-9f4b-d35313011e69",
   "similar_artist_mbid": "b6c18308-82c7-4ec1-a42d-e8488bce6618",
   "similar_artist_name": "坂本真綾",
   "total_listen_count": 147
  },
  {
   "recording_mbid": "e582a000-b7c3-4980-9bf9-9a8caa796fd6",
   "similar_artist_mbid": "b6c18308-82c7-4ec1-a42d-e8488bce6618",
   "similar_artist_name": "坂本真綾",
   "total_listen_count": 4726
  },
  {
   "recording_mbid": "6075a023-c737-4a14-9a12-c32584d81d69",
   "similar_artist_mbid": "b6c18308-82c7-4ec1-a42d-e8488bce6618",
   "similar_artist_name": "坂本真綾",
   "total_listen_count": 3
  },
  {
   "recording_mbid": "0b4990c9-f3fc-44bb-be8a-bcb44fa76862",
   "similar_artist_mbid": "b6c18308-82c7-4ec1-a42d-e8488bce6618",
   "similar_artist_name": "坂本真綾",
   "total_listen_count": 2
  },
  {
   "recording_mbid": "a8b4b67f-7a2f-4b09-acbf-bab23c8b340e",
   "similar_artist_mbid": "b6c18308-82c7-4ec1-a42d-e8488bce6618",
   "similar_artist_name": "坂本真綾",
   "total_listen_count": 32
  }
 ],
 "d02974dc-b4dc-4691-9705-33929ac731e1": [
  {
   "recording_mbid": "1431c422-43d4-4a30-b727-363f24fd1946",
   "similar_artist_mbid": "d02974dc-b4dc-4691-9705-33929ac731e1",
   "similar_artist_name": "妖精帝國",
   "total_listen_count": 75
  },
  {
   "recording_mbid": "585d23c6-04b9-4857-8228-edbb837f3458",
   "similar_artist_mbid": "d02974dc-b4dc-4691-9705-33929ac731e1",
   "similar_artist_name": "妖精帝國",
   "total_listen_count": 8342
  },
  {
   "recording_mbid": "ff973f73-a693-4754-ba71-5ddb26fcc000",
   "similar_artist_mbid": "d02974dc-b4dc-4691-9705-33929ac731e1",
   "similar_artist_name": "妖精帝國",
   "total_listen_count": 33
  },
  {
   "recording_mbid": "6a992567-9bb8-44e2-9f18-d5ab11a54574",
   "similar_artist_mbid": "d02974dc-b4dc-4691-9705-33929ac731e1",
   "similar_artist_name": "妖精帝國",
   "total_listen_count": 2353
  }
 ]
};
export const details: unknown = {
 "7c6b6bbd-bb83-4826-b360-8f24b48e3d6e": {
  "recording": {
   "name": "大貧民 -Instrumental-",
   "length": 259360
  },
  "artist": {
   "name": "supercell",
   "artists": [
    {
     "artist_mbid": "9b15ff5e-5bd1-43c2-821d-e31240aad334",
     "name": "supercell",
     "join_phrase": ""
    }
   ]
  },
  "release": {
   "name": "My Dearest",
   "caa_id": 43597604164,
   "caa_release_mbid": "6fa5a0fd-5f65-4b89-a7ec-c4d6d7e9d1e8",
   "year": 2011
  },
  "tag": {
   "recording": [
    {
     "tag": "pop",
     "count": 1,
     "genre_mbid": "911c7bbb-172d-4df8-9478-dbff4296e791"
    },
    {
     "tag": "instrumental",
     "count": 1,
     "genre_mbid": "4ae63770-68af-4fae-b0f1-5e53f372c743"
    },
    {
     "tag": "j-pop",
     "count": 1,
     "genre_mbid": "eba7715e-ee26-4989-8d49-9db382955419"
    }
   ],
   "release_group": [
    {
     "tag": "pop",
     "count": 1,
     "genre_mbid": "911c7bbb-172d-4df8-9478-dbff4296e791"
    },
    {
     "tag": "j-pop",
     "count": 1,
     "genre_mbid": "eba7715e-ee26-4989-8d49-9db382955419"
    }
   ],
   "artist": [
    {
     "tag": "j-pop",
     "count": 3,
     "genre_mbid": "eba7715e-ee26-4989-8d49-9db382955419"
    },
    {
     "tag": "pop rock",
     "count": 1,
     "genre_mbid": "797e2e85-5ffd-495c-a757-8b4079052f0e"
    },
    {
     "tag": "j-rock",
     "count": 1,
     "genre_mbid": "d181e978-c908-4f33-b2a2-f7454d0cb2c1"
    }
   ]
  }
 },
 "4e6f91a3-6c13-436a-8b67-4cc624eb4bc9": {
  "recording": {
   "name": "復讐 -Instrumental-",
   "length": 203000
  },
  "artist": {
   "name": "supercell",
   "artists": [
    {
     "artist_mbid": "9b15ff5e-5bd1-43c2-821d-e31240aad334",
     "name": "supercell",
     "join_phrase": ""
    }
   ]
  },
  "release": {
   "name": "Today Is A Beautiful Day 〜カラオケ集〜",
   "caa_id": 4390189490,
   "caa_release_mbid": "facfbd7f-e9fa-4983-8abc-b7b90fd135dd",
   "year": 2011
  },
  "tag": {
   "recording": [],
   "release_group": [
    {
     "tag": "rock",
     "count": 1,
     "genre_mbid": "0e3fc579-2d24-4f20-9dae-736e1ec78798"
    },
    {
     "tag": "electronic",
     "count": 1,
     "genre_mbid": "89255676-1f14-4dd8-bbad-fca839d6aff4"
    },
    {
     "tag": "pop",
     "count": 1,
     "genre_mbid": "911c7bbb-172d-4df8-9478-dbff4296e791"
    },
    {
     "tag": "anime",
     "count": 1
    },
    {
     "tag": "j-pop",
     "count": 1,
     "genre_mbid": "eba7715e-ee26-4989-8d49-9db382955419"
    }
   ],
   "artist": [
    {
     "tag": "pop rock",
     "count": 1,
     "genre_mbid": "797e2e85-5ffd-495c-a757-8b4079052f0e"
    },
    {
     "tag": "j-pop",
     "count": 3,
     "genre_mbid": "eba7715e-ee26-4989-8d49-9db382955419"
    },
    {
     "tag": "j-rock",
     "count": 1,
     "genre_mbid": "d181e978-c908-4f33-b2a2-f7454d0cb2c1"
    }
   ]
  }
 },
 "3b53d311-e51a-4f09-b451-f7505dd54452": {
  "recording": {
   "name": "またね",
   "length": 41000
  },
  "artist": {
   "name": "supercell feat. 初音ミク",
   "artists": [
    {
     "artist_mbid": "9b15ff5e-5bd1-43c2-821d-e31240aad334",
     "name": "supercell",
     "join_phrase": " feat. "
    },
    {
     "artist_mbid": "130d679a-9a92-4373-8348-0800b6b93a30",
     "name": "初音ミク",
     "join_phrase": ""
    }
   ]
  },
  "release": {
   "name": "supercell",
   "caa_id": 28729378048,
   "caa_release_mbid": "18584c5e-f13a-42d0-af57-90b10d88545f",
   "year": 2008
  },
  "tag": {
   "recording": [
    {
     "tag": "j-pop",
     "count": 1,
     "genre_mbid": "eba7715e-ee26-4989-8d49-9db382955419"
    },
    {
     "tag": "pop rock",
     "count": 1,
     "genre_mbid": "797e2e85-5ffd-495c-a757-8b4079052f0e"
    },
    {
     "tag": "vocaloid",
     "count": 2
    }
   ],
   "release_group": [
    {
     "tag": "rock",
     "count": 1,
     "genre_mbid": "0e3fc579-2d24-4f20-9dae-736e1ec78798"
    },
    {
     "tag": "pop",
     "count": 1,
     "genre_mbid": "911c7bbb-172d-4df8-9478-dbff4296e791"
    },
    {
     "tag": "j-pop",
     "count": 3,
     "genre_mbid": "eba7715e-ee26-4989-8d49-9db382955419"
    },
    {
     "tag": "j-rock",
     "count": 3,
     "genre_mbid": "d181e978-c908-4f33-b2a2-f7454d0cb2c1"
    },
    {
     "tag": "pop rock",
     "count": 2,
     "genre_mbid": "797e2e85-5ffd-495c-a757-8b4079052f0e"
    },
    {
     "tag": "vocaloid",
     "count": 1
    }
   ],
   "artist": [
    {
     "tag": "ネギ",
     "count": 2
    },
    {
     "tag": "vocaloid",
     "count": 34
    },
    {
     "tag": "pop rock",
     "count": 3,
     "genre_mbid": "797e2e85-5ffd-495c-a757-8b4079052f0e"
    },
    {
     "tag": "j-pop",
     "count": 6,
     "genre_mbid": "eba7715e-ee26-4989-8d49-9db382955419"
    },
    {
     "tag": "絶対領域",
     "count": 2
    },
    {
     "tag": "feminine vocal range",
     "count": 2
    }
   ]
  }
 },
 "43589ed8-083d-46bc-af9e-895f7d7bff0a": {
  "recording": {
   "name": "百回目のキス",
   "length": 286000
  },
  "artist": {
   "name": "supercell",
   "artists": [
    {
     "artist_mbid": "9b15ff5e-5bd1-43c2-821d-e31240aad334",
     "name": "supercell",
     "join_phrase": ""
    }
   ]
  },
  "release": {
   "name": "ZIGAEXPERIENTIA",
   "caa_id": 5852256333,
   "caa_release_mbid": "177c6660-898a-47c3-a363-f3495de57d70",
   "year": 2013
  },
  "tag": {
   "recording": [],
   "release_group": [
    {
     "tag": "j-pop",
     "count": 2,
     "genre_mbid": "eba7715e-ee26-4989-8d49-9db382955419"
    }
   ],
   "artist": [
    {
     "tag": "j-rock",
     "count": 1,
     "genre_mbid": "d181e978-c908-4f33-b2a2-f7454d0cb2c1"
    },
    {
     "tag": "pop rock",
     "count": 1,
     "genre_mbid": "797e2e85-5ffd-495c-a757-8b4079052f0e"
    },
    {
     "tag": "j-pop",
     "count": 3,
     "genre_mbid": "eba7715e-ee26-4989-8d49-9db382955419"
    }
   ]
  }
 },
 "57f767db-8671-48de-a679-949fbda2e493": {
  "recording": {
   "name": "恋は戦争",
   "length": 270000
  },
  "artist": {
   "name": "マチゲリータ",
   "artists": [
    {
     "artist_mbid": "6e5c9532-55fa-4441-9f95-e330f15546ea",
     "name": "マチゲリータ",
     "join_phrase": ""
    }
   ]
  },
  "release": {
   "name": "supercell tribute ~Stowaways~",
   "caa_id": 10168325719,
   "caa_release_mbid": "316e92f5-6359-44d0-9f59-a8aa5414b08a",
   "year": 2010
  },
  "tag": {
   "recording": [
    {
     "tag": "vocaloid",
     "count": 1
    }
   ],
   "release_group": [
    {
     "tag": "vocaloid",
     "count": 1
    }
   ],
   "artist": []
  }
 },
 "6b84dee3-3f3f-4733-8ffb-57284d731066": {
  "recording": {
   "name": "罪人",
   "length": 226720
  },
  "artist": {
   "name": "supercell",
   "artists": [
    {
     "artist_mbid": "9b15ff5e-5bd1-43c2-821d-e31240aad334",
     "name": "supercell",
     "join_phrase": ""
    }
   ]
  },
  "release": {
   "name": "My Dearest",
   "caa_id": 43597604164,
   "caa_release_mbid": "6fa5a0fd-5f65-4b89-a7ec-c4d6d7e9d1e8",
   "year": 2011
  },
  "tag": {
   "recording": [
    {
     "tag": "j-pop",
     "count": 1,
     "genre_mbid": "eba7715e-ee26-4989-8d49-9db382955419"
    },
    {
     "tag": "pop",
     "count": 1,
     "genre_mbid": "911c7bbb-172d-4df8-9478-dbff4296e791"
    }
   ],
   "release_group": [
    {
     "tag": "pop",
     "count": 1,
     "genre_mbid": "911c7bbb-172d-4df8-9478-dbff4296e791"
    },
    {
     "tag": "j-pop",
     "count": 1,
     "genre_mbid": "eba7715e-ee26-4989-8d49-9db382955419"
    }
   ],
   "artist": [
    {
     "tag": "j-pop",
     "count": 3,
     "genre_mbid": "eba7715e-ee26-4989-8d49-9db382955419"
    },
    {
     "tag": "pop rock",
     "count": 1,
     "genre_mbid": "797e2e85-5ffd-495c-a757-8b4079052f0e"
    },
    {
     "tag": "j-rock",
     "count": 1,
     "genre_mbid": "d181e978-c908-4f33-b2a2-f7454d0cb2c1"
    }
   ]
  }
 },
 "f4f9c635-32e2-4889-8be9-50814340dcb0": {
  "recording": {
   "name": "No title (Reol Oneman Live 2022 激情アラート at Tokyo)",
   "length": null
  },
  "artist": {
   "name": "Reol",
   "artists": [
    {
     "artist_mbid": "aea6ccea-deb0-44bb-886e-d91aa4c358bf",
     "name": "Reol",
     "join_phrase": ""
    }
   ]
  },
  "release": {
   "name": "COLORED DISC",
   "caa_id": 34112633638,
   "caa_release_mbid": "213ffa8a-4020-4b4f-8ad6-c978994a1c83",
   "year": 2022
  },
  "tag": {
   "recording": [],
   "release_group": [],
   "artist": [
    {
     "tag": "utaite",
     "count": 1
    },
    {
     "tag": "j-pop",
     "count": 2,
     "genre_mbid": "eba7715e-ee26-4989-8d49-9db382955419"
    },
    {
     "tag": "electropop",
     "count": 1,
     "genre_mbid": "3f3388b4-e36a-4bf8-a0be-66b10d92aaa4"
    },
    {
     "tag": "singer-songwriter",
     "count": 1,
     "genre_mbid": "455f264b-db00-4716-991d-fbd32dc24523"
    }
   ]
  }
 },
 "16e12eb0-105a-467c-869e-ec8a243191fe": {
  "recording": {
   "name": "Syrup",
   "length": 249333
  },
  "artist": {
   "name": "れをる",
   "artists": [
    {
     "artist_mbid": "aea6ccea-deb0-44bb-886e-d91aa4c358bf",
     "name": "れをる",
     "join_phrase": ""
    }
   ]
  },
  "release": {
   "name": "極彩色",
   "caa_id": 11276361040,
   "caa_release_mbid": "69c712ff-64ca-46ab-a063-af4ce5f8c3de",
   "year": 2015
  },
  "tag": {
   "recording": [],
   "release_group": [
    {
     "tag": "rock",
     "count": 1,
     "genre_mbid": "0e3fc579-2d24-4f20-9dae-736e1ec78798"
    },
    {
     "tag": "electronic",
     "count": 1,
     "genre_mbid": "89255676-1f14-4dd8-bbad-fca839d6aff4"
    },
    {
     "tag": "pop",
     "count": 1,
     "genre_mbid": "911c7bbb-172d-4df8-9478-dbff4296e791"
    },
    {
     "tag": "j-pop",
     "count": 1,
     "genre_mbid": "eba7715e-ee26-4989-8d49-9db382955419"
    }
   ],
   "artist": [
    {
     "tag": "j-pop",
     "count": 2,
     "genre_mbid": "eba7715e-ee26-4989-8d49-9db382955419"
    },
    {
     "tag": "singer-songwriter",
     "count": 1,
     "genre_mbid": "455f264b-db00-4716-991d-fbd32dc24523"
    },
    {
     "tag": "electropop",
     "count": 1,
     "genre_mbid": "3f3388b4-e36a-4bf8-a0be-66b10d92aaa4"
    },
    {
     "tag": "utaite",
     "count": 1
    }
   ]
  }
 },
 "80b5970e-6d82-40b7-8060-aaac76a2dbeb": {
  "recording": {
   "name": "水底游歩道",
   "length": 304000
  },
  "artist": {
   "name": "れをる",
   "artists": [
    {
     "artist_mbid": "aea6ccea-deb0-44bb-886e-d91aa4c358bf",
     "name": "れをる",
     "join_phrase": ""
    }
   ]
  },
  "release": {
   "name": "極彩色",
   "caa_id": 11276361040,
   "caa_release_mbid": "69c712ff-64ca-46ab-a063-af4ce5f8c3de",
   "year": 2015
  },
  "tag": {
   "recording": [],
   "release_group": [
    {
     "tag": "rock",
     "count": 1,
     "genre_mbid": "0e3fc579-2d24-4f20-9dae-736e1ec78798"
    },
    {
     "tag": "pop",
     "count": 1,
     "genre_mbid": "911c7bbb-172d-4df8-9478-dbff4296e791"
    },
    {
     "tag": "electronic",
     "count": 1,
     "genre_mbid": "89255676-1f14-4dd8-bbad-fca839d6aff4"
    },
    {
     "tag": "j-pop",
     "count": 1,
     "genre_mbid": "eba7715e-ee26-4989-8d49-9db382955419"
    }
   ],
   "artist": [
    {
     "tag": "utaite",
     "count": 1
    },
    {
     "tag": "j-pop",
     "count": 2,
     "genre_mbid": "eba7715e-ee26-4989-8d49-9db382955419"
    },
    {
     "tag": "electropop",
     "count": 1,
     "genre_mbid": "3f3388b4-e36a-4bf8-a0be-66b10d92aaa4"
    },
    {
     "tag": "singer-songwriter",
     "count": 1,
     "genre_mbid": "455f264b-db00-4716-991d-fbd32dc24523"
    }
   ]
  }
 },
 "09fcc1eb-a446-498d-b573-0c9424369664": {
  "recording": {
   "name": "Q? (Music Video)",
   "length": 195000
  },
  "artist": {
   "name": "Reol",
   "artists": [
    {
     "artist_mbid": "aea6ccea-deb0-44bb-886e-d91aa4c358bf",
     "name": "Reol",
     "join_phrase": ""
    }
   ]
  },
  "release": {
   "name": "第六感",
   "caa_id": 31400582181,
   "caa_release_mbid": "c47a5a2f-eb29-4ee8-86c7-4b5f61ad1cef",
   "year": 2021
  },
  "tag": {
   "recording": [],
   "release_group": [],
   "artist": [
    {
     "tag": "j-pop",
     "count": 2,
     "genre_mbid": "eba7715e-ee26-4989-8d49-9db382955419"
    },
    {
     "tag": "utaite",
     "count": 1
    },
    {
     "tag": "electropop",
     "count": 1,
     "genre_mbid": "3f3388b4-e36a-4bf8-a0be-66b10d92aaa4"
    },
    {
     "tag": "singer-songwriter",
     "count": 1,
     "genre_mbid": "455f264b-db00-4716-991d-fbd32dc24523"
    }
   ]
  }
 },
 "198dfc8d-045e-498b-9abd-a5bb6ff0ef02": {
  "recording": {
   "name": "Lunatic",
   "length": 197000
  },
  "artist": {
   "name": "REOL",
   "artists": [
    {
     "artist_mbid": "8852b087-c17d-4df5-9699-96d52cb31fc5",
     "name": "REOL",
     "join_phrase": ""
    }
   ]
  },
  "release": {
   "name": "Σ",
   "caa_id": 44451653010,
   "caa_release_mbid": "886c7e78-f488-4e30-8cce-1c7e428bdcb9",
   "year": 2016
  },
  "tag": {
   "recording": [],
   "release_group": [
    {
     "tag": "j-pop",
     "count": 3,
     "genre_mbid": "eba7715e-ee26-4989-8d49-9db382955419"
    }
   ],
   "artist": [
    {
     "tag": "electropop",
     "count": 1,
     "genre_mbid": "3f3388b4-e36a-4bf8-a0be-66b10d92aaa4"
    },
    {
     "tag": "electronic",
     "count": 1,
     "genre_mbid": "89255676-1f14-4dd8-bbad-fca839d6aff4"
    }
   ]
  }
 },
 "4c6cb8f5-d1e4-4dff-80d6-c411894921f1": {
  "recording": {
   "name": "+♂ver れをる",
   "length": 216000
  },
  "artist": {
   "name": "Reol",
   "artists": [
    {
     "artist_mbid": "aea6ccea-deb0-44bb-886e-d91aa4c358bf",
     "name": "Reol",
     "join_phrase": ""
    }
   ]
  },
  "release": {
   "name": "+♂ver れをる",
   "caa_id": 43960057019,
   "caa_release_mbid": "5e02bb62-b583-4a59-9778-c8daf70eadab",
   "year": 2014
  },
  "tag": {
   "recording": [],
   "release_group": [],
   "artist": [
    {
     "tag": "electropop",
     "count": 1,
     "genre_mbid": "3f3388b4-e36a-4bf8-a0be-66b10d92aaa4"
    },
    {
     "tag": "utaite",
     "count": 1
    },
    {
     "tag": "singer-songwriter",
     "count": 1,
     "genre_mbid": "455f264b-db00-4716-991d-fbd32dc24523"
    },
    {
     "tag": "j-pop",
     "count": 2,
     "genre_mbid": "eba7715e-ee26-4989-8d49-9db382955419"
    }
   ]
  }
 },
 "3cd8b79b-4a58-4d4f-af6a-5ae90f5eb8a0": {
  "recording": {
   "name": "細やかに蓋をして",
   "length": 226033
  },
  "artist": {
   "name": "坂本真綾",
   "artists": [
    {
     "artist_mbid": "b6c18308-82c7-4ec1-a42d-e8488bce6618",
     "name": "坂本真綾",
     "join_phrase": ""
    }
   ]
  },
  "release": {
   "name": "今日だけの音楽",
   "caa_id": 25611719590,
   "caa_release_mbid": "d89e1a27-7f42-4085-908c-0434d1540945",
   "year": 2019
  },
  "tag": {
   "recording": [],
   "release_group": [
    {
     "tag": "j-pop",
     "count": 1,
     "genre_mbid": "eba7715e-ee26-4989-8d49-9db382955419"
    }
   ],
   "artist": [
    {
     "tag": "anime",
     "count": 3
    },
    {
     "tag": "j-pop",
     "count": 3,
     "genre_mbid": "eba7715e-ee26-4989-8d49-9db382955419"
    },
    {
     "tag": "macross",
     "count": 2
    },
    {
     "tag": "singer-songwriter",
     "count": 2,
     "genre_mbid": "455f264b-db00-4716-991d-fbd32dc24523"
    },
    {
     "tag": "japanese",
     "count": 2
    },
    {
     "tag": "macross frontier",
     "count": 1
    }
   ]
  }
 },
 "e228caad-19ba-4f15-9f4b-d35313011e69": {
  "recording": {
   "name": "冬のペタル",
   "length": 37000
  },
  "artist": {
   "name": "坂本真綾",
   "artists": [
    {
     "artist_mbid": "b6c18308-82c7-4ec1-a42d-e8488bce6618",
     "name": "坂本真綾",
     "join_phrase": ""
    }
   ]
  },
  "release": {
   "name": "Napple Tale 怪獣図鑑",
   "caa_id": 35842838526,
   "caa_release_mbid": "b24ba5a6-c96c-4e52-8f88-dc9255da3b53",
   "year": 2000
  },
  "tag": {
   "recording": [],
   "release_group": [],
   "artist": [
    {
     "tag": "japanese",
     "count": 2
    },
    {
     "tag": "anime",
     "count": 3
    },
    {
     "tag": "macross frontier",
     "count": 1
    },
    {
     "tag": "singer-songwriter",
     "count": 2,
     "genre_mbid": "455f264b-db00-4716-991d-fbd32dc24523"
    },
    {
     "tag": "macross",
     "count": 2
    },
    {
     "tag": "j-pop",
     "count": 3,
     "genre_mbid": "eba7715e-ee26-4989-8d49-9db382955419"
    }
   ]
  }
 },
 "e582a000-b7c3-4980-9bf9-9a8caa796fd6": {
  "recording": {
   "name": "homemade christmas",
   "length": 280200
  },
  "artist": {
   "name": "坂本真綾",
   "artists": [
    {
     "artist_mbid": "b6c18308-82c7-4ec1-a42d-e8488bce6618",
     "name": "坂本真綾",
     "join_phrase": ""
    }
   ]
  },
  "release": {
   "name": "Driving in the silence",
   "caa_id": 12674009554,
   "caa_release_mbid": "0e1380a9-c364-4a30-882b-3427130d14ba",
   "year": 2011
  },
  "tag": {
   "recording": [],
   "release_group": [
    {
     "tag": "j-pop",
     "count": 1,
     "genre_mbid": "eba7715e-ee26-4989-8d49-9db382955419"
    },
    {
     "tag": "os:ok",
     "count": 1
    }
   ],
   "artist": [
    {
     "tag": "macross",
     "count": 2
    },
    {
     "tag": "japanese",
     "count": 2
    },
    {
     "tag": "j-pop",
     "count": 3,
     "genre_mbid": "eba7715e-ee26-4989-8d49-9db382955419"
    },
    {
     "tag": "macross frontier",
     "count": 1
    },
    {
     "tag": "singer-songwriter",
     "count": 2,
     "genre_mbid": "455f264b-db00-4716-991d-fbd32dc24523"
    },
    {
     "tag": "anime",
     "count": 3
    }
   ]
  }
 },
 "6075a023-c737-4a14-9a12-c32584d81d69": {
  "recording": {
   "name": "MC3",
   "length": 274000
  },
  "artist": {
   "name": "坂本真綾",
   "artists": [
    {
     "artist_mbid": "b6c18308-82c7-4ec1-a42d-e8488bce6618",
     "name": "坂本真綾",
     "join_phrase": ""
    }
   ]
  },
  "release": {
   "name": "菫 / 言葉にできない",
   "caa_id": 32818250821,
   "caa_release_mbid": "ead2d577-fe54-40a4-92f8-d8324abf1a5f",
   "year": 2022
  },
  "tag": {
   "recording": [],
   "release_group": [],
   "artist": [
    {
     "tag": "anime",
     "count": 3
    },
    {
     "tag": "japanese",
     "count": 2
    },
    {
     "tag": "singer-songwriter",
     "count": 2,
     "genre_mbid": "455f264b-db00-4716-991d-fbd32dc24523"
    },
    {
     "tag": "macross",
     "count": 2
    },
    {
     "tag": "macross frontier",
     "count": 1
    },
    {
     "tag": "j-pop",
     "count": 3,
     "genre_mbid": "eba7715e-ee26-4989-8d49-9db382955419"
    }
   ]
  }
 },
 "0b4990c9-f3fc-44bb-be8a-bcb44fa76862": {
  "recording": {
   "name": "CC社れあれあネット・ショッピング",
   "length": 234000
  },
  "artist": {
   "name": "シューゴ//CV.皆川純子, レナ//CV.中原麻衣, ほたる//CV.川澄綾子, ミレイユ//CV.松岡由貴, 凰花//CV.増田ゆき, 砂嵐三十郎//CV.増谷康紀, アウラ//CV.坂本真綾, レキ//CV.保志総一朗, バルムンク//CV.檜山修之",
   "artists": [
    {
     "artist_mbid": "57116a5b-9340-4c94-8afa-2b5d56d4e8dc",
     "name": "シューゴ",
     "join_phrase": "//CV."
    },
    {
     "artist_mbid": "e79e6aaf-7bf7-4347-92da-4201852a1f37",
     "name": "皆川純子",
     "join_phrase": ", "
    },
    {
     "artist_mbid": "680db230-e8ec-4cb3-9e4c-f58f4ae4cfb4",
     "name": "レナ",
     "join_phrase": "//CV."
    },
    {
     "artist_mbid": "607a1346-ad83-41a4-8216-4da091a30d83",
     "name": "中原麻衣",
     "join_phrase": ", "
    },
    {
     "artist_mbid": "622fe45f-8a83-45ea-b378-eff2424949e9",
     "name": "ほたる",
     "join_phrase": "//CV."
    },
    {
     "artist_mbid": "70d33a9a-347b-4bf6-b8e1-a98a4f98f696",
     "name": "川澄綾子",
     "join_phrase": ", "
    },
    {
     "artist_mbid": "db1800a1-8fb0-43de-a52b-4ed6754c3eab",
     "name": "ミレイユ",
     "join_phrase": "//CV."
    },
    {
     "artist_mbid": "e90a975e-0faa-4e5e-91bf-bf54a5e86520",
     "name": "松岡由貴",
     "join_phrase": ", "
    },
    {
     "artist_mbid": "fb8a34e8-f4ac-4169-8d48-713336293091",
     "name": "凰花",
     "join_phrase": "//CV."
    },
    {
     "artist_mbid": "4b9a15ca-f7f9-4ad3-b32f-2b8b33094767",
     "name": "増田ゆき",
     "join_phrase": ", "
    },
    {
     "artist_mbid": "a4562fd1-4d38-4574-8de6-e120728ef6ef",
     "name": "砂嵐三十郎",
     "join_phrase": "//CV."
    },
    {
     "artist_mbid": "9b72df04-b03e-41f4-b376-64aa59548f92",
     "name": "増谷康紀",
     "join_phrase": ", "
    },
    {
     "artist_mbid": "72b2b4c5-898f-412d-a311-d1ae2780b227",
     "name": "アウラ",
     "join_phrase": "//CV."
    },
    {
     "artist_mbid": "b6c18308-82c7-4ec1-a42d-e8488bce6618",
     "name": "坂本真綾",
     "join_phrase": ", "
    },
    {
     "artist_mbid": "5bd5fd40-a38f-419c-8dd0-1556768ff40a",
     "name": "レキ",
     "join_phrase": "//CV."
    },
    {
     "artist_mbid": "0988a2ff-b602-4f60-bf4f-ce0557b7411e",
     "name": "保志総一朗",
     "join_phrase": ", "
    },
    {
     "artist_mbid": "dc7fee4b-3da9-42a7-94ae-74a478be7144",
     "name": "バルムンク",
     "join_phrase": "//CV."
    },
    {
     "artist_mbid": "6d263b94-74d0-4396-96ff-9c99ba808ea9",
     "name": "檜山修之",
     "join_phrase": ""
    }
   ]
  },
  "release": {
   "name": ".hack//黄昏の腕輪伝説 Character Song & Story",
   "caa_id": 30631871784,
   "caa_release_mbid": "ee494473-c32c-45e0-a6ba-3cb8badc0013",
   "year": 2003
  },
  "tag": {
   "recording": [],
   "release_group": [],
   "artist": [
    {
     "tag": "artist-cv",
     "count": 1
    },
    {
     "tag": "singer-songwriter",
     "count": 2,
     "genre_mbid": "455f264b-db00-4716-991d-fbd32dc24523"
    },
    {
     "tag": "macross",
     "count": 2
    },
    {
     "tag": "j-pop",
     "count": 3,
     "genre_mbid": "eba7715e-ee26-4989-8d49-9db382955419"
    },
    {
     "tag": "anime",
     "count": 3
    },
    {
     "tag": "macross frontier",
     "count": 1
    }
   ]
  }
 },
 "a8b4b67f-7a2f-4b09-acbf-bab23c8b340e": {
  "recording": {
   "name": "色彩 (Instrumental)",
   "length": 270000
  },
  "artist": {
   "name": "坂本真綾",
   "artists": [
    {
     "artist_mbid": "b6c18308-82c7-4ec1-a42d-e8488bce6618",
     "name": "坂本真綾",
     "join_phrase": ""
    }
   ]
  },
  "release": {
   "name": "幸せについて私が知っている5つの方法 / 色彩",
   "caa_id": 9613247891,
   "caa_release_mbid": "2c503c84-5b1f-402f-ab46-e597edb4b053",
   "year": 2015
  },
  "tag": {
   "recording": [],
   "release_group": [],
   "artist": [
    {
     "tag": "anime",
     "count": 3
    },
    {
     "tag": "japanese",
     "count": 2
    },
    {
     "tag": "singer-songwriter",
     "count": 2,
     "genre_mbid": "455f264b-db00-4716-991d-fbd32dc24523"
    },
    {
     "tag": "macross frontier",
     "count": 1
    },
    {
     "tag": "j-pop",
     "count": 3,
     "genre_mbid": "eba7715e-ee26-4989-8d49-9db382955419"
    },
    {
     "tag": "macross",
     "count": 2
    }
   ]
  }
 }
};
export const tagged: unknown = [
 {
  "percent": 47.5365511716403,
  "recording_mbid": "fa11e8fa-6432-4ec5-aa43-e3323d985f12",
  "source": "release-group",
  "tag_count": 5
 },
 {
  "percent": 71.84057680753054,
  "recording_mbid": "a2896b93-0b8f-4a58-84da-7514e38545d5",
  "source": "release-group",
  "tag_count": 5
 },
 {
  "percent": 100,
  "recording_mbid": "3d1fdb97-89fa-432c-ae37-54eb1544462c",
  "source": "release-group",
  "tag_count": 5
 },
 {
  "percent": 100,
  "recording_mbid": "155d30db-940b-44f2-a47c-1e591af7ffd9",
  "source": "release-group",
  "tag_count": 3
 },
 {
  "percent": 52.13298618065292,
  "recording_mbid": "1457d67c-5a97-4f3b-986b-5b81a98c273a",
  "source": "release-group",
  "tag_count": 3
 },
 {
  "percent": 100,
  "recording_mbid": "f133a38f-5556-4538-974e-b0f4aa8927f4",
  "source": "release-group",
  "tag_count": 3
 }
];
export const similar: unknown = [
 {
  "artist_mbid": "b6b2bb8d-54a9-491f-9607-7b546023b433",
  "name": "Pixies",
  "comment": "",
  "type": "Group",
  "gender": null,
  "score": 3144,
  "reference_mbid": "8f6bd1e4-fbe1-4f50-aa9b-94c450ec0f11"
 },
 {
  "artist_mbid": "a74b1b7f-71a5-4011-9441-d0b5e4122711",
  "name": "Radiohead",
  "comment": "",
  "type": "Group",
  "gender": null,
  "score": 7045,
  "reference_mbid": "8f6bd1e4-fbe1-4f50-aa9b-94c450ec0f11"
 },
 {
  "artist_mbid": "a74b1b7f-71a5-4011-9441-d0b5e4122711",
  "name": "Radiohead",
  "comment": "",
  "type": "Group",
  "gender": null,
  "score": 7045,
  "reference_mbid": "8f6bd1e4-fbe1-4f50-aa9b-94c450ec0f11"
 },
 {
  "artist_mbid": "b6b2bb8d-54a9-491f-9607-7b546023b433",
  "name": "Pixies",
  "comment": "",
  "type": "Group",
  "gender": null,
  "score": 3144,
  "reference_mbid": "8f6bd1e4-fbe1-4f50-aa9b-94c450ec0f11"
 },
 {
  "artist_mbid": "9b15ff5e-5bd1-43c2-821d-e31240aad334",
  "name": "supercell",
  "comment": "J-pop",
  "type": "Group",
  "gender": null,
  "score": 106,
  "reference_mbid": "d02974dc-b4dc-4691-9705-33929ac731e1"
 },
 {
  "artist_mbid": "d2a92ee2-27ce-4e71-bfc5-12e34fe8ef56",
  "name": "Mili",
  "comment": "Japanese band",
  "type": "Group",
  "gender": null,
  "score": 50,
  "reference_mbid": "d02974dc-b4dc-4691-9705-33929ac731e1"
 },
 {
  "artist_mbid": "e21857d5-3256-4547-afb3-4b6ded592596",
  "name": "Gorillaz",
  "comment": "virtual band",
  "type": "Group",
  "gender": null,
  "score": 41,
  "reference_mbid": "d02974dc-b4dc-4691-9705-33929ac731e1"
 },
 {
  "artist_mbid": "e21857d5-3256-4547-afb3-4b6ded592596",
  "name": "Gorillaz",
  "comment": "virtual band",
  "type": "Group",
  "gender": null,
  "score": 41,
  "reference_mbid": "d02974dc-b4dc-4691-9705-33929ac731e1"
 },
 {
  "artist_mbid": "85d76093-9865-4605-97fa-8c910929d366",
  "name": "LiSA",
  "comment": "Japanese pop/rock singer",
  "type": "Person",
  "gender": "Female",
  "score": 122,
  "reference_mbid": "d02974dc-b4dc-4691-9705-33929ac731e1"
 }
];
