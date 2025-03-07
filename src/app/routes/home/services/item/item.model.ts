type status = -1 | 0 | 1 | 2 | 3 | 4 | 5;

interface Search {
  page: number;
  search: string;
  status: status;
}

interface Image {
  idN: number;
  status: status;
}

interface Archive {
  file: string;
  key: string;
  code: string;
  image: Image;
}

interface Item {
  _id: string;
  code: string;
  desc: string;
  images: Image[]
  countItems?: number;
}

type LeanItem = Omit<Item, '_id' | "images"> & { key: string };

interface Info {
  status: {
    defective: number;
    found: number;
    photographed: number;
    prepared: number;
    edited: number;
    saved: number;
  };
  success: number;
}

interface Delete { 
  data: Item; 
  deletedStatus: Info["status"]; 
}

class ItemModel {
  constructor(
    private item: Item
  ) { }

  public get _id() {
    return this.item._id;
  }

  public get key() {
    return this.code.slice(0, 6);
  }

  public get code() {
    return this.item.code;
  }

  public get desc() {
    return this.item.desc;
  }

  public get allIDN(): number[] {
    return this.item.images
      .filter(({ status }) => status === 5)
      .map(({ idN }) => idN)
      .sort((a, b) => a - b);
  }

  public get raw(): LeanItem {
    return {
      key: this.key,
      code: this.code.slice(6, 10),
      desc: this.desc,
    }
  }

  public set raw(item: Item) {
    this.item = item;
  }

  get hasAnyStatus(): boolean {
    return this.item.images.length > 0;
  }

  public get hasImages(): boolean {
    return this.item.images.some(({ status }) => status === 5);
  }

  public get allStatus(): status[] {
    return this.item.images.map(({ status }) => status);
  }

  public hasStatus(status: status): boolean {
    return this.item.images.some(({ status: _ }) => _ === status);
  }

  public isReseted(status: status): boolean {
    return this.item.images.every(({ status: _ }) => _ === status);
  }

  private findImageIndex(_idN: number): number {
    return this.item.images.findIndex(({ idN: _ }) => _ === (_idN + 1));
  }

  public getStatus(_idN: number): status | null {
    const i = this.findImageIndex(_idN);
    if (i === -1) return null;
    return this.item.images[i].status;
  }

  public setStatus(idN: number, status: status): void {
    this.item.images.push({ idN: idN + 1, status });
  }

  public updateStatus(_idN: number, status: status | `${status}`): void {
    if (typeof status == 'string') {
      if (!/^[0-5]$/.test(status)) return;
      status = Number(status) as status;
    }
    const i = this.findImageIndex(_idN);
    if (i === -1) return;
    this.item.images[i].status = status;
  }

  public removeStatus(_idN: number): status | null {
    const i = this.findImageIndex(_idN);
    if (i === -1) return null;
    const status = this.getStatus(_idN);
    this.item.images.splice(i, 1);
    return status;
  }

  public setImages(status: status | null): void {
    const images = status !== null
      ? new Array(3)
        .fill({ status })
        .map(({ status }, _idN) => {
          return { idN: _idN + 1, status };
        })
      : [];
    this.item.images = images;
  }
}

export { ItemModel };
export type { Archive, Delete, Item, Info, LeanItem, Search, status };

